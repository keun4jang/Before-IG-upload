import type { CanonicalCardFields, NormalizedEvent, RawSmccIssue, SmccIssue } from '../schemas';
import { scanBadCurrency, compareCardFee } from '../validators/fee';
import { validateCardLanguage } from '../validators/language';
import { compareCardLocation } from '../validators/location';
import { compareCardTime } from '../validators/time';
import { compareCardDate } from '../validators/date';
import { compareFields } from '../validators/card-compare';
import { withIds } from './validate-event';

function norm(s: string): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, '');
}

/** 프로그램별 필수 추가정보가 카드에 있는지 */
function validateAdditionalInfo(e: NormalizedEvent, cardText: string): RawSmccIssue[] {
  const issues: RawSmccIssue[] = [];
  if (e.programType === 'book-dive') {
    const t = norm(cardText);
    if (!t.includes('needs') && !t.includes('니즈')) {
      issues.push({
        category: 'program-rule',
        severity: 'warning',
        title: 'Needs 누락',
        description: 'Book Dive 카드에는 Needs 노출이 필요합니다.',
        confidence: 0.7,
      });
    }
    if (!t.includes('책') && !t.includes('book')) {
      issues.push({
        category: 'program-rule',
        severity: 'warning',
        title: '책 정보 누락',
        description: '자유롭게 읽고 싶은 책 1권 안내가 필요합니다.',
        confidence: 0.6,
      });
    }
  }
  return issues;
}

/** 카드(정답 대비) 종합 검수 */
export function validateCardText(
  e: NormalizedEvent,
  canonical: CanonicalCardFields,
  cardText: string,
): SmccIssue[] {
  if (!cardText.trim()) return [];
  const raw: RawSmccIssue[] = [
    ...scanBadCurrency(cardText),
    ...compareCardFee(e, cardText),
    ...validateCardLanguage(e, cardText),
    ...compareCardLocation(e, cardText),
    ...compareCardDate(e, cardText),
    ...compareCardTime(e, cardText),
    ...compareFields(e, canonical, cardText),
    ...validateAdditionalInfo(e, cardText),
  ];
  return withIds(raw, 'card');
}
