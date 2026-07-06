/**
 * 분석 워커 (BullMQ).
 * REDIS_URL 이 있으면 큐를 소비하고, 없으면 안내 후 대기합니다(graceful).
 *
 * 실행: pnpm --filter @big/worker start
 */
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { runAnalysis } from '@big/shared';
import { getPrisma } from '@big/db';
import { ANALYSIS_QUEUE, getRedisConnection, type AnalysisJobData } from './queue.js';
import { getLlmVerdictFn, getSearchFn } from './providers.js';

async function persistResult(runId: string, result: Awaited<ReturnType<typeof runAnalysis>>) {
  try {
    const prisma = await getPrisma();
    await prisma.analysisRun.update({
      where: { id: runId },
      data: {
        status: 'succeeded',
        finishedAt: new Date(),
        overallScore: result.score.overall,
        summaryJson: result.summary as unknown as object,
        resultJson: result as unknown as object,
      },
    });
  } catch (err) {
    console.error('[worker] DB 저장 실패 (DEMO/무DB 환경일 수 있음):', (err as Error).message);
  }
}

async function main() {
  const conn = getRedisConnection();
  if (!conn) {
    console.warn(
      '[worker] REDIS_URL 이 설정되지 않았습니다. 큐 모드가 비활성화됩니다.\n' +
        '         web 앱은 in-process 분석으로 계속 동작합니다. 큐를 쓰려면 REDIS_URL 을 설정하세요.',
    );
    // 컨테이너가 즉시 종료되지 않도록 유지
    setInterval(() => {}, 1 << 30);
    return;
  }

  const connection = new IORedis(conn.url, { maxRetriesPerRequest: null });
  console.log('[worker] 분석 워커 시작. 큐:', ANALYSIS_QUEUE);

  const worker = new Worker<AnalysisJobData>(
    ANALYSIS_QUEUE,
    async (job) => {
      const { runId, input } = job.data;
      console.log(`[worker] 분석 시작 run=${runId}`);
      const result = await runAnalysis(input, {
        search: getSearchFn(),
        llm: getLlmVerdictFn(),
      });
      await persistResult(runId, result);
      console.log(`[worker] 분석 완료 run=${runId} score=${result.score.overall}`);
      return { overallScore: result.score.overall };
    },
    // 버전 간 ioredis 타입 차이는 런타임에 무관하므로 경계에서 캐스팅.
    { connection: connection as never, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2) },
  );

  worker.on('failed', (job, err) => {
    console.error(`[worker] 실패 run=${job?.data.runId}:`, err.message);
  });

  const shutdown = async () => {
    console.log('[worker] 종료 중...');
    await worker.close();
    await connection.quit();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[worker] 치명적 오류:', err);
  process.exit(1);
});
