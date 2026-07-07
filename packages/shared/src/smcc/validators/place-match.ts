import type { PlaceCandidate, PlaceVerdict } from '../schemas';

function tokens(s: string): string[] {
  return (s ?? '')
    .toLowerCase()
    .replace(/[,.]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/** query 와 candidate displayName 의 토큰 겹침 점수 (0~1) */
export function scorePlace(query: string, candidate: string): number {
  const q = new Set(tokens(query));
  const c = new Set(tokens(candidate));
  if (q.size === 0 || c.size === 0) return 0;
  let overlap = 0;
  for (const t of q) if (c.has(t)) overlap++;
  return overlap / q.size;
}

export interface PlaceMatchResult {
  verdict: PlaceVerdict;
  confidence: number;
  best: number;
}

/** 후보들 중 최고 점수로 판정 (단정 금지, confidence 함께) */
export function matchPlace(query: string, candidates: PlaceCandidate[]): PlaceMatchResult {
  if (candidates.length === 0) {
    return { verdict: 'not-verifiable', confidence: 0.2, best: 0 };
  }
  const best = Math.max(...candidates.map((c) => scorePlace(query, c.displayName)));
  if (best >= 0.6) return { verdict: 'likely-match', confidence: Math.min(0.85, best), best };
  if (best >= 0.3) return { verdict: 'manual-review', confidence: 0.5, best };
  return { verdict: 'possible-mismatch', confidence: 0.4, best };
}
