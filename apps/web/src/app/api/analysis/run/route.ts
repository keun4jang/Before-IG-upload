import { z } from 'zod';
import { handler, ok } from '@/lib/http';
import { startAnalysis } from '@/lib/services/analysis-service';

export const dynamic = 'force-dynamic';

const schema = z.object({ projectId: z.string().min(1) });

export const POST = handler(async (req: Request) => {
  const { projectId } = schema.parse(await req.json());
  const run = await startAnalysis(projectId);
  return ok({ run }, 202);
});
