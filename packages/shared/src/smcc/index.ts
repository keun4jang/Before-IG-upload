export * from './schemas';
export * from './constants';
export * from './program-config';
export * from './csv';
export * from './formatters/date';
export * from './formatters/time';
export * from './formatters/money';
export * from './formatters/labels';
export * from './engine/normalize-event';
export * from './engine/build-canonical-card';
export * from './engine/validate-event';
export * from './engine/validate-card-text';
export * from './engine/analyze-standalone';
export * from './validators/place-match';
export type { WeekdayButtonScan } from './validators/consistency';
export * from './fixtures';

import type { CanonicalCardFields, NormalizedEvent, SmccIssue } from './schemas';
import { buildCanonicalCard } from './engine/build-canonical-card';
import { validateEvent } from './engine/validate-event';
import { validateCardText, type CardReviewOptions } from './engine/validate-card-text';

export interface SmccReview {
  event: NormalizedEvent;
  canonical: CanonicalCardFields;
  eventIssues: SmccIssue[];
  cardIssues: SmccIssue[];
  issues: SmccIssue[];
}

/** 이벤트(+선택적 카드텍스트) 종합 검수 */
export function reviewEvent(
  e: NormalizedEvent,
  cardText = '',
  options: CardReviewOptions = {},
): SmccReview {
  const canonical = buildCanonicalCard(e);
  const eventIssues = validateEvent(e);
  const cardIssues =
    cardText.trim() || options.weekdayButton != null
      ? validateCardText(e, canonical, cardText, options)
      : [];
  return { event: e, canonical, eventIssues, cardIssues, issues: [...eventIssues, ...cardIssues] };
}
