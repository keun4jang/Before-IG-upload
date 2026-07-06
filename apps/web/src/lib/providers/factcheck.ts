/**
 * Search + LLM provider 어댑터 (사실 검토용).
 * 키가 없으면 undefined 를 반환 → 파이프라인은 "근거 부족/검토 필요"로 보수적으로 처리.
 */
import type { EvidenceSource, LlmVerdict, LlmVerdictFn, SearchFn } from '@big/shared';
import { env } from '../env';

// --- Search ------------------------------------------------------------------
export function getSearchFn(): SearchFn | undefined {
  if (env.searchProvider === 'tavily' && env.tavilyApiKey) return tavilySearch;
  if (env.searchProvider === 'serpapi' && env.serpapiApiKey) return serpapiSearch;
  return undefined;
}

const tavilySearch: SearchFn = async (query) => {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: env.tavilyApiKey,
      query,
      max_results: 4,
      search_depth: 'basic',
    }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const data = (await res.json()) as { results?: Array<{ title: string; url: string; content: string }> };
  return (data.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: (r.content ?? '').slice(0, 280),
    sourceType: 'web',
  }));
};

const serpapiSearch: SearchFn = async (query) => {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('q', query);
  url.searchParams.set('api_key', env.serpapiApiKey!);
  url.searchParams.set('num', '4');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpAPI ${res.status}`);
  const data = (await res.json()) as { organic_results?: Array<{ title: string; link: string; snippet?: string }> };
  return (data.organic_results ?? []).slice(0, 4).map((r) => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet ?? '',
    sourceType: 'web',
  }));
};

// --- LLM ---------------------------------------------------------------------
export function getLlmVerdictFn(): LlmVerdictFn | undefined {
  if (env.llmProvider === 'openai' && env.openaiApiKey) return openaiVerdict;
  if (env.llmProvider === 'anthropic' && env.anthropicApiKey) return anthropicVerdict;
  return undefined;
}

const SYSTEM_PROMPT = `당신은 한국어 콘텐츠의 사실 검토를 돕는 신중한 검토자입니다.
주어진 문장(claim)과 근거 자료를 바탕으로만 판단하세요. 절대 단정하지 마세요.
verdict 는 다음 중 하나여야 합니다: mostly_supported, partially_unclear, insufficient_evidence, conflicting, review_needed.
근거가 부족하면 insufficient_evidence 또는 review_needed 를 사용하세요.
반드시 아래 JSON 형식으로만 답하세요:
{"verdict": "...", "rationale": "한국어 한두 문장", "confidence": 0.0~1.0}`;

function buildUserPrompt(claim: string, sources: EvidenceSource[]): string {
  const src = sources
    .map((s, i) => `[${i + 1}] ${s.title}\n${s.url}\n${s.snippet}`)
    .join('\n\n');
  return `문장: "${claim}"\n\n근거 자료:\n${src || '(없음)'}`;
}

function parseVerdict(text: string): LlmVerdict {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('LLM 응답 파싱 실패');
  const parsed = JSON.parse(match[0]) as Partial<LlmVerdict>;
  const allowed = ['mostly_supported', 'partially_unclear', 'insufficient_evidence', 'conflicting', 'review_needed'];
  return {
    verdict: allowed.includes(parsed.verdict as string)
      ? (parsed.verdict as LlmVerdict['verdict'])
      : 'review_needed',
    rationale: parsed.rationale ?? '근거 기반 검토 결과입니다.',
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.4))),
  };
}

const openaiVerdict: LlmVerdictFn = async (claim, sources) => {
  const res = await fetch(`${env.openaiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: env.openaiModel,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(claim, sources) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return parseVerdict(data.choices?.[0]?.message?.content ?? '');
};

const anthropicVerdict: LlmVerdictFn = async (claim, sources) => {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.anthropicApiKey!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: env.anthropicModel,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(claim, sources) }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  return parseVerdict(data.content?.[0]?.text ?? '');
};
