import { z } from 'zod';
import { fail, handler, ok } from '@/lib/http';
import { getVisionExtractFn } from '@/lib/providers/vision';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({ imageDataUrl: z.string().min(1) });

/**
 * 이미지를 비전 LLM 으로 직접 이해해서 텍스트를 추출.
 * LLM_PROVIDER 키가 없으면 available:false 를 반환 → 클라이언트는 로컬 OCR로 자동 대체.
 */
export const POST = handler(async (req: Request) => {
  const extract = getVisionExtractFn();
  if (!extract) return ok({ available: false });

  const { imageDataUrl } = schema.parse(await req.json());
  try {
    const text = await extract(imageDataUrl);
    return ok({ available: true, text });
  } catch (err) {
    return fail(err instanceof Error ? err.message : '이미지 분석에 실패했습니다.', 502);
  }
});
