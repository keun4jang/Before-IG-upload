import { handler, ok } from '@/lib/http';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string; assetId: string } };

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  await getStore().removeAsset(params.id, params.assetId);
  return ok({ deleted: true });
});
