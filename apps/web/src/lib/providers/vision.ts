/**
 * 비전(이미지 이해) provider 어댑터.
 * OCR(글자 인식)과 달리 이미지 전체 맥락을 이해해서, 장식 요소(선택 안 된 요일 버튼 등)는
 * 걸러내고 실제 의미 있는 텍스트만 정리해서 돌려준다. LLM_PROVIDER 키가 없으면
 * undefined 를 반환 → 호출부는 Tesseract OCR로 자동 대체(graceful degradation).
 */
import { env } from '../env';

export type VisionExtractFn = (imageDataUrl: string) => Promise<string>;

export function getVisionExtractFn(): VisionExtractFn | undefined {
  if (env.llmProvider === 'openai' && env.openaiApiKey) return openaiVisionExtract;
  if (env.llmProvider === 'anthropic' && env.anthropicApiKey) return anthropicVisionExtract;
  return undefined;
}

const PROMPT = `이 이미지는 인스타그램 카드뉴스(SMCC 커피모임 카드 등) 한 장입니다.
이미지 안에 있는 "실제 의미 있는 텍스트"만 한 줄씩 정리해서 출력하세요.

포함할 것:
- 사람 이름, 아이디(@...)
- 프로그램명 배지 텍스트
- 언어/지역/참가조건(또는 참가비)/시간 아이콘 옆 값
- Date, Meet at 같은 라벨과 그 옆 값(날짜, 카페명, 주소)
- Needs, 코스, 거리 등 추가 정보
- 상단 요일(Mon~Sun) 버튼 중 진하게 강조(선택)된 요일 하나만 "선택요일: Wed" 형식으로 포함

제외할 것:
- 선택되지 않은(연하게 표시된) 나머지 요일 버튼들
- 순수 장식 아이콘, 로고, 워터마크
- 줄바꿈/배경 등 레이아웃 정보에 대한 설명

설명이나 마크다운 없이, 정리된 텍스트 줄만 출력하세요.`;

function extractText(resText: string): string {
  return resText.trim();
}

const openaiVisionExtract: VisionExtractFn = async (imageDataUrl) => {
  const res = await fetch(`${env.openaiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: env.openaiModel,
      temperature: 0,
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI vision ${res.status}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return extractText(data.choices?.[0]?.message?.content ?? '');
};

const anthropicVisionExtract: VisionExtractFn = async (imageDataUrl) => {
  const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('이미지 형식을 읽을 수 없습니다.');
  const [, mediaType, base64] = match;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.anthropicApiKey!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: env.anthropicModel,
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic vision ${res.status}`);
  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  return extractText(data.content?.[0]?.text ?? '');
};
