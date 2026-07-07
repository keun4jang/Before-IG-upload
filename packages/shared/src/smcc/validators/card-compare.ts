import { PROGRAM_CONFIG } from '../program-config';
import type { CanonicalCardFields, NormalizedEvent, RawSmccIssue } from '../schemas';

function norm(s: string): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, '');
}
function has(text: string, sub: string): boolean {
  if (!sub.trim()) return true;
  return norm(text).includes(norm(sub));
}

/** 카드 텍스트가 정답 필드를 포함하는지 비교 */
export function compareFields(
  e: NormalizedEvent,
  canonical: CanonicalCardFields,
  cardText: string,
): RawSmccIssue[] {
  const issues: RawSmccIssue[] = [];

  // 날짜/시간은 전용 validator(compareCardDate/compareCardTime)에서 정밀 비교
  const checks: Array<{ label: string; value: string; severity: 'error' | 'warning' | 'info' }> = [
    { label: '프로그램명', value: canonical.programName, severity: 'warning' },
    { label: '지역', value: canonical.locationLabel, severity: 'info' },
    { label: '카페', value: e.cafeName, severity: 'warning' },
    { label: '호스트', value: canonical.hostLabel.replace(/^@/, ''), severity: 'info' },
  ];

  if (PROGRAM_CONFIG[e.programType].requiresDistance && canonical.distanceLabel) {
    checks.push({ label: '거리', value: canonical.distanceLabel, severity: 'warning' });
  }

  for (const c of checks) {
    if (!c.value.trim()) continue;
    if (!has(cardText, c.value)) {
      issues.push({
        category: 'source-mismatch',
        severity: c.severity,
        title: `${c.label} 불일치`,
        description: `정답 값이 카드에서 확인되지 않습니다.`,
        expected: c.value,
        confidence: 0.6,
        resolutionHint: '원본/정답 값과 카드 표기를 비교하세요.',
      });
    }
  }
  return issues;
}
