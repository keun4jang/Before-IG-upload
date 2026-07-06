import { z } from 'zod';
import { handler, ok } from '@/lib/http';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

const assetSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  previewUrl: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  sizeBytes: z.number().optional(),
  seedText: z.string().optional(),
});

const bodySchema = z.object({ assets: z.array(assetSchema).min(1).max(20) });

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { assets } = bodySchema.parse(await req.json());
  const created = await getStore().addAssets(params.id, assets);
  return ok({ assets: created }, 201);
});
