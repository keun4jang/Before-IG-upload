import { z } from 'zod';
import { fail, handler, ok } from '@/lib/http';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const detail = await getStore().getProject(params.id);
  if (!detail) return fail('프로젝트를 찾을 수 없습니다.', 404);
  return ok(detail);
});

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(['draft', 'analyzing', 'analyzed', 'archived']).optional(),
});

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const patch = patchSchema.parse(await req.json());
  const project = await getStore().updateProject(params.id, patch);
  if (!project) return fail('프로젝트를 찾을 수 없습니다.', 404);
  return ok({ project });
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  await getStore().deleteProject(params.id);
  return ok({ deleted: true });
});
