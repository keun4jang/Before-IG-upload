import type { CanonicalCardFields, NormalizedEvent } from '../schemas';
import { programName } from '../formatters/labels';

/** NormalizedEvent → 카드용 "정답" 필드 세트 */
export function buildCanonicalCard(e: NormalizedEvent): CanonicalCardFields {
  const isKr = e.languageMode === 'KR';

  const locationLabel = isKr ? e.locationCanonicalKr : e.locationCanonicalEn;
  const dateLabel = isKr ? e.dateLabelKr : e.dateLabelEn;

  const distanceLabel = e.distanceKm != null ? `${e.distanceKm}km` : '';
  const routeLabel = e.routeStops.map((s) => s.name).join(' → ');

  // 카페 표기: 카페명(고유명사) 원문 유지 + 지점명
  const hostLabel = e.hostInstagram;

  let needsLabel = '';
  if (e.programType === 'book-dive') {
    needsLabel = isKr
      ? '자유롭게 읽고 싶은 책 1권 (전자책, 종이책 모두 가능합니다.)'
      : 'One book you want to read (e-book or paper both OK)';
  }

  return {
    programName: programName(e.programType, e.languageMode),
    languageLabel: e.languageLabelExpected,
    locationLabel,
    dateLabel,
    timeLabel: e.timeLabel,
    feeOrConditionLabel: e.feeLabelExpected,
    distanceLabel,
    routeLabel,
    needsLabel,
    hostLabel,
  };
}

/** 카드 정답 필드를 라벨/값 리스트로 (UI/복사용, 빈 값 제외) */
export function canonicalFieldList(
  c: CanonicalCardFields,
): Array<{ key: string; label: string; value: string }> {
  const rows: Array<{ key: string; label: string; value: string }> = [
    { key: 'programName', label: '프로그램', value: c.programName },
    { key: 'languageLabel', label: '언어', value: c.languageLabel },
    { key: 'locationLabel', label: '지역', value: c.locationLabel },
    { key: 'dateLabel', label: '날짜', value: c.dateLabel },
    { key: 'timeLabel', label: '시간', value: c.timeLabel },
    { key: 'feeOrConditionLabel', label: '참가비/조건', value: c.feeOrConditionLabel },
    { key: 'distanceLabel', label: '거리', value: c.distanceLabel },
    { key: 'routeLabel', label: '코스', value: c.routeLabel },
    { key: 'needsLabel', label: 'Needs', value: c.needsLabel },
    { key: 'hostLabel', label: '호스트', value: c.hostLabel },
  ];
  return rows.filter((r) => r.value.trim().length > 0);
}

export function canonicalToText(c: CanonicalCardFields): string {
  return canonicalFieldList(c)
    .map((r) => `${r.label}: ${r.value}`)
    .join('\n');
}

export function canonicalToMarkdown(c: CanonicalCardFields): string {
  return canonicalFieldList(c)
    .map((r) => `- **${r.label}**: ${r.value}`)
    .join('\n');
}
