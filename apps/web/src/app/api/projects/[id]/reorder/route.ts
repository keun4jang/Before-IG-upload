import { z } from 'zod';
import { handler, ok } from '@/lib/http';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

const schema = z.object({ orderedAssetIds: z.array(z.string()).min(1) });

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const { orderedAssetIds } = schema.parse(await req.json());
  await getStore().reorderAssets(params.id, orderedAssetIds);
  return ok({ reordered: true });
});
