import { z } from 'zod';
import { handler, ok } from '@/lib/http';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const projects = await getStore().listProjects();
  return ok({ projects });
});

const createSchema = z.object({
  name: z.string().min(1, '프로젝트 이름을 입력하세요.').max(120),
  description: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export const POST = handler(async (req: Request) => {
  const body = createSchema.parse(await req.json());
  const project = await getStore().createProject(body);
  return ok({ project }, 201);
});
