import type { NormalizedEvent, RawSmccIssue } from '../schemas';

export function validateEventLocation(e: NormalizedEvent): RawSmccIssue[] {
  const issues: RawSmccIssue[] = [];
  if (!e.locationRaw.trim()) {
    issues.push({
      category: 'location-rule',
      severity: 'info',
      title: '지역 확인 필요',
      description: '원본 지역이 비어 있습니다.',
      confidence: 0.4,
    });
  }
  return issues;
}

/** 카드 지역 라벨이 언어에 맞는지 (EN 카드에 한글 지역명 등) */
export function compareCardLocation(e: NormalizedEvent, cardText: string): RawSmccIssue[] {
  const issues: RawSmccIssue[] = [];
  if (e.locationCanonicalKr === e.locationCanonicalEn) return issues; // 표준 매핑 없음
  const wrong = e.languageMode === 'EN' ? e.locationCanonicalKr : e.locationCanonicalEn;
  const right = e.languageMode === 'EN' ? e.locationCanonicalEn : e.locationCanonicalKr;
  if (cardText.includes(wrong) && !cardText.includes(right)) {
    issues.push({
      category: 'location-rule',
      severity: 'warning',
      title: '지역 표기 언어',
      description: '카드 언어에 맞는 지역 표기를 사용하세요.',
      expected: right,
      actual: wrong,
      confidence: 0.7,
    });
  }
  return issues;
}
