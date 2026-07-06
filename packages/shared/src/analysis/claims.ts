/**
 * 사실 검토 대상 문장(claim) 추출 + 근거 기반 검토.
 *
 * ⚠️ 원칙: 절대 단정하지 않는다.
 * - 출처가 없으면 단정 금지 → 'review_needed'
 * - 출처 1건 → 'insufficient_evidence' (참고 가능 수준, 추가 확인 권장)
 * - 고위험(의료/법률/금융)은 근거가 강해도 "원문 재확인 권장"을 항상 덧붙인다.
 */
import type {
  ClaimCheck,
  ClaimDomain,
  ClaimVerdict,
  EvidenceSource,
  RawIssue,
} from '../types';
import { splitSentences } from './normalize';
import type { TextUnit } from './duplication';

export interface ClaimCandidate {
  text: string;
  domain: ClaimDomain;
  highRisk: boolean;
  scopeRefId: string;
  start: number;
  end: number;
}

const SIGNALS: Array<{ domain: ClaimDomain; highRisk: boolean; re: RegExp }> = [
  {
    domain: 'medical',
    highRisk: true,
    re: /효능|효과|치료|완치|다이어트|체중\s*감량|면역|질환|질병|암|혈압|당뇨|부작용|디톡스|해독/,
  },
  {
    domain: 'legal',
    highRisk: true,
    re: /법률|법적|세금|세무|절세|계약|소송|불법|합법|저작권|특허|위반|처벌/,
  },
  {
    domain: 'financial',
    highRisk: true,
    re: /투자|수익률|원금|보장|금리|대출|주식|코인|가상자산|연봉|보험|환급|무료.?수익/,
  },
  { domain: 'ranking', highRisk: false, re: /(?:^|[\s(])(1위|최초|최고|최대|최저|가장|유일|1등|세계\s*최|국내\s*최)/ },
  {
    domain: 'statistic',
    highRisk: false,
    re: /\d+(?:\.\d+)?\s*(?:%|퍼센트|프로|배|명|개|건|원|위|억|만|천만|kg|km|점|위안|달러)/,
  },
  { domain: 'date', highRisk: false, re: /\d{4}\s*년|\d{1,2}\s*월\s*\d{1,2}\s*일|\d{4}[-.]\d{1,2}[-.]\d{1,2}/ },
  { domain: 'entity', highRisk: false, re: /according to|["“][^"”]{4,}["”]|에 따르면|보도에 따르면|연구에 따르면/ },
];

/** 문장에서 검토가 필요한 claim 후보를 추출. */
export function extractClaims(units: TextUnit[]): ClaimCandidate[] {
  const candidates: ClaimCandidate[] = [];
  for (const unit of units) {
    for (const s of splitSentences(unit.text)) {
      let matched: { domain: ClaimDomain; highRisk: boolean } | null = null;
      for (const sig of SIGNALS) {
        if (sig.re.test(s.text)) {
          matched = { domain: sig.domain, highRisk: sig.highRisk };
          break; // SIGNALS는 우선순위(고위험 먼저) 순으로 정렬됨
        }
      }
      if (!matched) continue;
      candidates.push({
        text: s.text,
        domain: matched.domain,
        highRisk: matched.highRisk,
        scopeRefId: unit.scopeRefId,
        start: s.start,
        end: s.end,
      });
    }
  }
  return candidates;
}

// --- 근거 기반 검토 -----------------------------------------------------------

export type SearchFn = (query: string) => Promise<EvidenceSource[]>;

export interface LlmVerdict {
  verdict: ClaimVerdict;
  rationale: string;
  confidence: number;
}

export type LlmVerdictFn = (
  claim: string,
  sources: EvidenceSource[],
) => Promise<LlmVerdict>;

export interface FactCheckOptions {
  search?: SearchFn;
  llm?: LlmVerdictFn;
  now?: () => Date;
}

const DOMAIN_HINT: Record<ClaimDomain, string> = {
  statistic: '수치/통계',
  date: '날짜',
  ranking: '순위/비교',
  medical: '의료/건강',
  legal: '법률/세무',
  financial: '금융/투자',
  entity: '기관/인물/인용',
  general: '일반',
};

/** claim 후보들을 근거 기반으로 검토하여 ClaimCheck로 변환. */
export async function buildClaimChecks(
  candidates: ClaimCandidate[],
  opts: FactCheckOptions = {},
): Promise<ClaimCheck[]> {
  const now = (opts.now ?? (() => new Date()))().toISOString();
  const checks: ClaimCheck[] = [];

  for (const c of candidates) {
    let sources: EvidenceSource[] = [];
    if (opts.search) {
      try {
        sources = await opts.search(c.text);
      } catch {
        sources = [];
      }
    }

    let verdict: ClaimVerdict;
    let rationale: string;
    let confidence: number;

    if (opts.llm && sources.length > 0) {
      try {
        const v = await opts.llm(c.text, sources);
        verdict = v.verdict;
        rationale = v.rationale;
        confidence = v.confidence;
      } catch {
        ({ verdict, rationale, confidence } = fallbackVerdict(sources));
      }
    } else {
      ({ verdict, rationale, confidence } = fallbackVerdict(sources));
    }

    // 고위험 영역 보수화: 강한 긍정 판정을 완화하고 재확인 문구 강제
    if (c.highRisk) {
      if (verdict === 'mostly_supported') {
        verdict = 'partially_unclear';
      }
      confidence = Math.min(confidence, 0.6);
      rationale += ` (${DOMAIN_HINT[c.domain]} 정보는 전문가 상담 또는 공식 원문 재확인을 권장합니다.)`;
    }

    checks.push({
      claimText: c.text,
      domain: c.domain,
      highRisk: c.highRisk,
      verdict,
      rationale,
      confidence,
      sources,
      checkedAt: now,
    });
  }

  return checks;
}

function fallbackVerdict(sources: EvidenceSource[]): {
  verdict: ClaimVerdict;
  rationale: string;
  confidence: number;
} {
  if (sources.length === 0) {
    return {
      verdict: 'review_needed',
      rationale:
        '자동 근거 수집이 비활성화되어 있거나 관련 출처를 찾지 못했습니다. 직접 검토와 출처 확인을 권장합니다.',
      confidence: 0.2,
    };
  }
  if (sources.length === 1) {
    return {
      verdict: 'insufficient_evidence',
      rationale: '관련 출처 1건을 찾았습니다. 참고 가능하나 근거가 충분하지 않으니 추가 확인을 권장합니다.',
      confidence: 0.4,
    };
  }
  return {
    verdict: 'partially_unclear',
    rationale: `관련 출처 ${sources.length}건을 찾았습니다. 문장과 출처의 일치 여부는 직접 확인이 필요합니다.`,
    confidence: 0.5,
  };
}

/** claim 후보 + 검토 결과를 이슈로 변환. */
export function claimToIssue(candidate: ClaimCandidate, check: ClaimCheck): RawIssue {
  const scopeType = candidate.scopeRefId === 'caption' ? 'caption' : 'slide';
  const severity = candidate.highRisk ? 'high' : 'medium';
  return {
    scopeType,
    scopeRefId: candidate.scopeRefId,
    category: 'fact',
    severity,
    confidence: check.confidence,
    sourceText: candidate.text,
    explanation: `[${DOMAIN_HINT[candidate.domain]}] ${check.rationale}`,
    claim: check,
    location: {
      scopeType,
      scopeRefId: candidate.scopeRefId,
      start: candidate.start,
      end: candidate.end,
      excerpt: candidate.text,
    },
  };
}
