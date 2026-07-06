import { fail, handler, ok } from '@/lib/http';
import { getStore } from '@/lib/store';
import { startAnalysis } from '@/lib/services/analysis-service';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/** 분석 run 상태/결과 조회 (클라이언트 폴링용). */
export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const run = await getStore().getRun(params.id);
  if (!run) return fail('분석 실행을 찾을 수 없습니다.', 404);
  return ok({ run });
});

/** 재분석: 기존 run 의 프로젝트로 새 분석 시작. */
export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const run = await getStore().getRun(params.id);
  if (!run) return fail('분석 실행을 찾을 수 없습니다.', 404);
  const next = await startAnalysis(run.projectId);
  return ok({ run: next }, 202);
});
