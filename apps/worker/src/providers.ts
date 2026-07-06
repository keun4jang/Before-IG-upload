/**
 * worker 전용 provider 어댑터 (env 기반). web 과 독립적으로 동작합니다.
 * 키가 없으면 undefined → 파이프라인이 보수적으로 처리.
 */
import type { EvidenceSource, LlmVerdict, LlmVerdictFn, SearchFn } from '@big/shared';

export function getSearchFn(): SearchFn | undefined {
  if (process.env.SEARCH_PROVIDER === 'tavily' && process.env.TAVILY_API_KEY) {
    return async (query) => {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, max_results: 4 }),
      });
      if (!res.ok) throw new Error(`Tavily ${res.status}`);
      const data = (await res.json()) as { results?: Array<{ title: string; url: string; content: string }> };
      return (data.results ?? []).map(
        (r): EvidenceSource => ({ title: r.title, url: r.url, snippet: (r.content ?? '').slice(0, 280), sourceType: 'web' }),
      );
    };
  }
  return undefined;
}

export function getLlmVerdictFn(): LlmVerdictFn | undefined {
  if (process.env.LLM_PROVIDER === 'openai' && process.env.OPENAI_API_KEY) {
    return async (claim, sources): Promise<LlmVerdict> => {
      const res = await fetch(`${process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                '한국어 사실 검토자. 근거만으로 판단하고 단정하지 마세요. verdict: mostly_supported|partially_unclear|insufficient_evidence|conflicting|review_needed. JSON {"verdict","rationale","confidence"} 로만 답하세요.',
            },
            { role: 'user', content: `문장:"${claim}"\n근거:\n${sources.map((s) => `${s.title} ${s.url} ${s.snippet}`).join('\n')}` },
          ],
        }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}`);
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const m = (data.choices?.[0]?.message?.content ?? '').match(/\{[\s\S]*\}/);
      if (!m) throw new Error('parse');
      const p = JSON.parse(m[0]);
      return {
        verdict: p.verdict ?? 'review_needed',
        rationale: p.rationale ?? '근거 기반 검토',
        confidence: Math.max(0, Math.min(1, Number(p.confidence ?? 0.4))),
      };
    };
  }
  return undefined;
}
