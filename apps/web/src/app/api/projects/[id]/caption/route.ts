import { z } from 'zod';
import { handler, ok } from '@/lib/http';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

const schema = z.object({
  originalText: z.string().max(5000).optional(),
  editedText: z.string().max(5000).nullable().optional(),
});

export const PUT = handler(async (req: Request, { params }: Ctx) => {
  const patch = schema.parse(await req.json());
  const caption = await getStore().upsertCaption(params.id, patch);
  return ok({ caption });
});
