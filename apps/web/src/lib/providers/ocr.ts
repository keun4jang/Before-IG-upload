/**
 * OCR provider 어댑터.
 * - dummy: 데모용. 전달된 seed 텍스트 또는 안내 문구 반환. (키 불필요)
 * - tesseract: tesseract.js (설치돼 있으면). graceful fallback.
 * - google: Google Vision REST (GOOGLE_VISION_API_KEY 필요).
 */
import type { OcrImage, OcrProvider, OcrResult } from '@big/shared';
import { env } from '../env';

const dummyProvider: OcrProvider = {
  name: 'dummy',
  async recognize(image: OcrImage): Promise<OcrResult> {
    const seed = typeof image.data === 'string' && !image.data.startsWith('data:')
      ? image.data
      : '';
    return {
      text: seed || '(데모 OCR) 이미지의 텍스트를 이곳에 직접 입력하거나 붙여넣어 주세요.',
      confidence: seed ? 1 : 0.3,
      blocks: [],
    };
  },
};

const googleProvider: OcrProvider = {
  name: 'google',
  async recognize(image: OcrImage): Promise<OcrResult> {
    const content =
      typeof image.data === 'string'
        ? image.data.replace(/^data:[^;]+;base64,/, '')
        : Buffer.from(image.data).toString('base64');
    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${env.googleVisionApiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content },
              features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
              imageContext: { languageHints: ['ko', 'en'] },
            },
          ],
        }),
      },
    );
    if (!res.ok) throw new Error(`Google Vision ${res.status}`);
    const data = (await res.json()) as any;
    const ann = data.responses?.[0]?.fullTextAnnotation;
    return {
      text: ann?.text ?? '',
      confidence: 0.85,
      blocks: [],
    };
  },
};

const tesseractProvider: OcrProvider = {
  name: 'tesseract',
  async recognize(image: OcrImage): Promise<OcrResult> {
    // 동적 import: 미설치 시 상위에서 dummy 로 fallback.
    // webpackIgnore 로 번들러 정적 해석을 막아 미설치 상태에서도 빌드가 통과됩니다.
    const modName = 'tesseract.js';
    const { recognize } = (await import(/* webpackIgnore: true */ modName)) as any;
    const input = typeof image.data === 'string' ? image.data : Buffer.from(image.data);
    const { data } = await recognize(input, 'kor+eng');
    return {
      text: data.text ?? '',
      confidence: (data.confidence ?? 50) / 100,
      blocks: [],
    };
  },
};

export function getOcrProvider(): OcrProvider {
  switch (env.ocrProvider) {
    case 'google':
      return env.googleVisionApiKey ? googleProvider : dummyProvider;
    case 'tesseract':
      return {
        name: 'tesseract',
        async recognize(image) {
          try {
            return await tesseractProvider.recognize(image);
          } catch {
            return dummyProvider.recognize(image);
          }
        },
      };
    default:
      return dummyProvider;
  }
}
