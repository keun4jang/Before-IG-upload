import { z } from 'zod';
import { fail, handler, ok } from '@/lib/http';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

const schema = z.object({ runId: z.string().min(1), resolved: z.boolean() });

/** 이슈 "수정 완료 처리" 토글. */
export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const { runId, resolved } = schema.parse(await req.json());
  const run = await getStore().toggleIssue(runId, params.id, resolved);
  if (!run) return fail('분석 실행을 찾을 수 없습니다.', 404);
  return ok({ run });
});
