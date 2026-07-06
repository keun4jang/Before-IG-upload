/**
 * 분석 서비스: 저장소 + provider + 파이프라인을 연결.
 * DEMO 모드에서는 백그라운드로 실행하며 단계별 진행 상태를 노출합니다(로딩 UX).
 */
import {
  ANALYSIS_STEPS,
  runAnalysis,
  type AnalysisInput,
  type AnalysisRun,
} from '@big/shared';
import { env } from '../env';
import { getLlmVerdictFn, getSearchFn } from '../providers';
import { getStore } from '../store';
import type { ProjectDetail } from '../store/types';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function buildInput(detail: ProjectDetail): AnalysisInput {
  const slides = detail.slides
    .slice()
    .sort((a, b) => a.slideNumber - b.slideNumber)
    .map((s) => ({
      slideNumber: s.slideNumber,
      text: s.ocrEditedText ?? s.ocrRawText,
      ocrConfidence: s.ocrConfidence ?? undefined,
    }));
  const caption = detail.caption;
  return {
    slides,
    captionText: caption ? (caption.editedText ?? caption.originalText) : undefined,
    // claim 추출은 항상 수행합니다(검토 필요 문장을 보여주기 위해).
    // 외부 근거 수집(search/LLM)만 provider 유무에 따라 동작합니다.
    factCheckEnabled: true,
  };
}

/** 분석을 시작하고(비동기), 생성된 run 을 즉시 반환. */
export async function startAnalysis(projectId: string): Promise<AnalysisRun> {
  const store = getStore();
  const detail = await store.getProject(projectId);
  if (!detail) throw new Error('프로젝트를 찾을 수 없습니다.');
  if (detail.slides.length === 0 && !detail.caption?.originalText) {
    throw new Error('분석할 슬라이드 또는 캡션이 없습니다.');
  }

  const run = await store.createRun(projectId);
  await store.updateProject(projectId, { status: 'analyzing' });

  // 백그라운드 실행 (await 하지 않음 → 클라이언트는 폴링으로 진행 상태 확인)
  void executeRun(run.id, detail).catch(async (err) => {
    await store.updateRun(run.id, {
      status: 'failed',
      finishedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : '분석 중 오류가 발생했습니다.',
    });
    await store.updateProject(projectId, { status: 'draft' });
  });

  return run;
}

async function executeRun(runId: string, detail: ProjectDetail): Promise<void> {
  const store = getStore();
  await store.updateRun(runId, {
    status: 'running',
    progress: { step: 'prepare', percent: 3, message: '분석을 준비하고 있어요' },
  });

  const input = buildInput(detail);
  const result = await runAnalysis(input, {
    search: getSearchFn(),
    llm: getLlmVerdictFn(),
  });

  // 단계별 진행 상태를 순차적으로 노출 (데모에서는 시각적으로 보이도록 지연)
  for (const step of ANALYSIS_STEPS) {
    await store.updateRun(runId, {
      progress: { step: step.step, percent: step.percent, message: step.label },
    });
    if (env.demoMode) await sleep(300);
  }

  await store.updateRun(runId, {
    status: 'succeeded',
    finishedAt: new Date().toISOString(),
    overallScore: result.score.overall,
    result,
    progress: { step: 'finalize', percent: 100, message: '완료' },
  });
  await store.updateProject(detail.project.id, { status: 'analyzed' });
}
