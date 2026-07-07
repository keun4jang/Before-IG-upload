import { BAD_CURRENCY_PATTERNS, CONDITION_LABEL, FORBIDDEN_EN_CONDITION, USD_ALLOWED_LOCATIONS } from '../constants';
import type { NormalizedEvent, RawSmccIssue } from '../schemas';

function norm(s: string): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, '');
}
function has(text: string, sub: string): boolean {
  return norm(text).includes(norm(sub));
}

/** 잘못된 통화 표기(강한 오류) 스캔 */
export function scanBadCurrency(text: string): RawSmccIssue[] {
  const issues: RawSmccIssue[] = [];
  for (const p of BAD_CURRENCY_PATTERNS) {
    const m = text.match(p.re);
    if (m) {
      issues.push({
        category: 'fee-rule',
        severity: 'error',
        title: '통화 표기 오류',
        description: p.reason,
        actual: m[0],
        confidence: 0.9,
        resolutionHint: 'KR 은 "15,000원", EN 은 "$30" 형식으로 표기하세요.',
      });
    }
  }
  return issues;
}

/** 카드의 참가비/참가조건이 규칙과 맞는지 검사 */
export function compareCardFee(e: NormalizedEvent, cardText: string): RawSmccIssue[] {
  const issues: RawSmccIssue[] = [];
  const hasPrice = /\$\s?\d|\d[\d,]*\s*원|\d[\d,]*\s*달러/.test(cardText);

  if (e.feeMode === 'free') {
    // EN 금지 표현
    if (e.languageMode === 'EN') {
      for (const forbidden of FORBIDDEN_EN_CONDITION) {
        if (has(cardText, forbidden)) {
          issues.push({
            category: 'fee-rule',
            severity: 'error',
            title: '금지 표현',
            description: `"${forbidden}" 대신 "Min. 1 Drink" 를 사용하세요.`,
            expected: 'Min. 1 Drink',
            actual: forbidden,
            confidence: 0.9,
          });
        }
      }
    }
    if (hasPrice) {
      issues.push({
        category: 'fee-rule',
        severity: 'error',
        title: '무료 프로그램에 금액 표기',
        description: '무료 프로그램에는 참가비가 아니라 참가조건을 표기합니다.',
        expected: CONDITION_LABEL[e.languageMode],
        confidence: 0.8,
      });
    }
    if (!has(cardText, e.conditionLabelExpected)) {
      issues.push({
        category: 'fee-rule',
        severity: 'warning',
        title: '참가조건 누락',
        description: '참가조건 표기를 확인하세요.',
        expected: e.conditionLabelExpected,
        confidence: 0.6,
      });
    }
  } else {
    // 유료
    if (has(cardText, CONDITION_LABEL[e.languageMode]) && !hasPrice) {
      issues.push({
        category: 'fee-rule',
        severity: 'error',
        title: '유료인데 참가조건만 표기',
        description: '유료 프로그램은 참가비를 표기해야 합니다.',
        expected: e.feeLabelExpected,
        actual: CONDITION_LABEL[e.languageMode],
        confidence: 0.8,
      });
    }
    if (!has(cardText, e.feeLabelExpected)) {
      issues.push({
        category: 'fee-rule',
        severity: 'warning',
        title: '참가비 불일치',
        description: '규칙상 예상 참가비와 다릅니다.',
        expected: e.feeLabelExpected,
        confidence: 0.65,
        resolutionHint: '코스 카페 수/지역/언어에 따른 금액을 확인하세요.',
      });
    }
    // 달러는 멜버른만 허용
    const usdInCard = /\$\s?\d/.test(cardText);
    const isMelbourne = USD_ALLOWED_LOCATIONS.some((l) => has(e.locationRaw, l));
    if (usdInCard && !isMelbourne) {
      issues.push({
        category: 'fee-rule',
        severity: 'warning',
        title: '달러 표기 지역 확인',
        description: '달러($) 표기는 멜버른 진행 건에만 허용됩니다.',
        actual: e.locationCanonicalKr,
        confidence: 0.6,
      });
    }
  }
  return issues;
}
