import { BAD_CURRENCY_PATTERNS, CONDITION_LABEL, FORBIDDEN_EN_CONDITION, LOCATIONS } from '../constants';
import type { NormalizedEvent, RawSmccIssue } from '../schemas';

function norm(s: string): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, '');
}
function has(text: string, sub: string): boolean {
  return norm(text).includes(norm(sub));
}

/** 이벤트 지역이 국내(원화)인지 판정. 매칭 안 되면 null(불명). */
function isDomesticRegion(e: NormalizedEvent): boolean | null {
  const loc = LOCATIONS.find((l) =>
    l.match.some((m) => has(e.locationRaw, m) || has(e.locationCanonicalKr, m)),
  );
  return loc ? loc.domestic : null;
}

/** 카드에 참가조건/금지표현 검사 (언어 무관 — "Order 1 Drink" 등은 항상 금지). */
export function scanForbiddenCondition(cardText: string): RawSmccIssue[] {
  const issues: RawSmccIssue[] = [];
  for (const forbidden of FORBIDDEN_EN_CONDITION) {
    if (has(cardText, forbidden)) {
      issues.push({
        category: 'fee-rule',
        severity: 'error',
        title: '금지 표현',
        description: `"${forbidden}" 는 사용할 수 없습니다. "Min. 1 Drink" 로 표기하세요.`,
        expected: 'Min. 1 Drink',
        actual: forbidden,
        confidence: 0.9,
      });
    }
  }
  return issues;
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
    issues.push(...checkCurrencyRegion(e, cardText));
  }
  return issues;
}

/** 통화 ↔ 지역 규칙: 국내 지역은 원화, 달러($)는 해외 진행에만. (단독 검수에서도 재사용) */
export function checkCurrencyRegion(e: NormalizedEvent, cardText: string): RawSmccIssue[] {
  const issues: RawSmccIssue[] = [];
  const usdInCard = /\$\s?\d|\d\s*달러/.test(cardText);
  const wonInCard = /\d[\d,]*\s*원/.test(cardText);
  const domestic = isDomesticRegion(e);
  if (usdInCard && domestic === true) {
    issues.push({
      category: 'fee-rule',
      severity: 'error',
      title: '통화 오류 (국내 지역에 달러)',
      description: `${e.locationCanonicalKr}(국내)는 원화로 표기해야 합니다. 달러($)는 해외 진행에만 사용합니다.`,
      expected: '원(₩)',
      actual: '$',
      confidence: 0.85,
      resolutionHint: '금액을 원화로 바꾸세요.',
    });
  }
  if (wonInCard && domestic === false) {
    issues.push({
      category: 'fee-rule',
      severity: 'warning',
      title: '통화 확인 (해외 지역에 원화)',
      description: `${e.locationCanonicalKr}(해외)에 원화 표기가 있습니다. 현지 통화가 맞는지 확인하세요.`,
      actual: '원',
      confidence: 0.6,
    });
  }
  return issues;
}
