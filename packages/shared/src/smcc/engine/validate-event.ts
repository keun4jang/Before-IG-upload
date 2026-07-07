import type { NormalizedEvent, RawSmccIssue, SmccIssue } from '../schemas';
import { validateEventDate } from '../validators/date';
import { validateEventTime } from '../validators/time';
import { validateEventLocation } from '../validators/location';
import { validateEventRoute } from '../validators/route';

export function withIds(raw: RawSmccIssue[], prefix = 'iss'): SmccIssue[] {
  return raw.map((r, i) => ({ ...r, id: `${prefix}-${i + 1}` }));
}

/** 원본/정규화 자체의 규칙 검사 (카드 없이) */
export function validateEvent(e: NormalizedEvent): SmccIssue[] {
  const raw: RawSmccIssue[] = [
    ...validateEventDate(e),
    ...validateEventTime(e),
    ...validateEventLocation(e),
    ...validateEventRoute(e),
  ];
  return withIds(raw, 'ev');
}
