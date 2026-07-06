import { z } from 'zod';
import { handler, ok } from '@/lib/http';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string; n: string } };

const schema = z.object({ editedText: z.string().max(5000) });

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const { editedText } = schema.parse(await req.json());
  await getStore().updateSlideText(params.id, Number(params.n), editedText);
  return ok({ updated: true });
});
