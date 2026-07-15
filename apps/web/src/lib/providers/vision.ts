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
  if (env.llmProvider === 'gemini' && env.geminiApiKey) return geminiVisionExtract;
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
- 상단 요일(Mon~Sun) 버튼 7개를 왼쪽부터 순서대로 "요일버튼: Mon Tue Wed Thu Fri Sat Sun" 형식으로,
  적힌 그대로(오타·중복 포함) 출력. 그리고 그중 진하게 강조(선택)된 요일 하나를 "선택요일: Wed" 형식으로 포함
- 지역/국기 아이콘 자리에 국기 그림이 있으면 그 나라를 "국기나라: 대한민국" 처럼 한 줄로 포함
  (예: 호주 국기면 "국기나라: 호주", 싱가포르 국기면 "국기나라: 싱가포르", 일본이면 "국기나라: 일본").
  국기가 아니라 그냥 위치 핀(📍) 아이콘이면 이 줄은 넣지 마세요.

제외할 것:
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

/** Google Gemini (무료 티어 제공). Generative Language API 키 1개면 이미지 텍스트+국기 인식. */
const geminiVisionExtract: VisionExtractFn = async (imageDataUrl) => {
  const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('이미지 형식을 읽을 수 없습니다.');
  const [, mediaType, base64] = match;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${env.geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: PROMPT }, { inline_data: { mime_type: mediaType, data: base64 } }],
          },
        ],
        generationConfig: { temperature: 0, maxOutputTokens: 800 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini vision ${res.status}`);
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  return extractText(text);
};
