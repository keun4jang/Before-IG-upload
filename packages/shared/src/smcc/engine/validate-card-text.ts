import type { CanonicalCardFields, NormalizedEvent, RawSmccIssue, SmccIssue } from '../schemas';
import { scanBadCurrency, scanForbiddenCondition, compareCardFee } from '../validators/fee';
import { validateCardLanguage, validateLanguageLabel } from '../validators/language';
import { compareCardLocation, scanRegionTypo, validateFlagCountry } from '../validators/location';
import { compareCardTime } from '../validators/time';
import { compareCardDate } from '../validators/date';
import { compareFields } from '../validators/card-compare';
import {
  scanWeekdayButtonRowTypo,
  validateAddressRegion,
  validateRouteEndpoints,
  validateWeekdayButton,
} from '../validators/consistency';
import { withIds } from './validate-event';

export interface CardReviewOptions {
  /** 카드 상단 요일 버튼 (0=일 ~ 6=토). 지정 시 날짜 요일과 교차검증. */
  weekdayButton?: number | null;
  /** 카드 상단 요일 버튼 영역만 따로 OCR한 결과(칸별 + 전체 토큰). 버튼 오타 검사용. */
  weekdayButtons?: import('../validators/consistency').WeekdayButtonScan;
}

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
  options: CardReviewOptions = {},
): SmccIssue[] {
  if (!cardText.trim() && options.weekdayButton == null && !options.weekdayButtons) return [];
  const raw: RawSmccIssue[] = [
    ...scanBadCurrency(cardText),
    ...scanForbiddenCondition(cardText),
    ...compareCardFee(e, cardText),
    ...validateLanguageLabel(e, cardText),
    ...validateCardLanguage(e, cardText),
    ...compareCardLocation(e, cardText),
    ...scanRegionTypo(cardText),
    ...validateFlagCountry(e, cardText),
    ...compareCardDate(e, cardText),
    ...compareCardTime(e, cardText),
    ...compareFields(e, canonical, cardText),
    ...validateAdditionalInfo(e, cardText),
    ...validateAddressRegion(e, cardText),
    ...validateRouteEndpoints(e),
    ...validateWeekdayButton(e, options.weekdayButton),
    ...scanWeekdayButtonRowTypo(options.weekdayButtons, e.weekdayExpected),
  ];
  return withIds(raw, 'card');
}
