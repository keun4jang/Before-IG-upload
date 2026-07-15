import { PROGRAM_CONFIG } from '../program-config';
import type { CanonicalCardFields, LanguageMode, NormalizedEvent, RawSmccIssue } from '../schemas';

function norm(s: string): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, '');
}
function has(text: string, sub: string): boolean {
  if (!sub.trim()) return true;
  return norm(text).includes(norm(sub));
}

const DOWNGRADE: Record<'error' | 'warning' | 'info', 'error' | 'warning' | 'info'> = {
  error: 'warning',
  warning: 'info',
  info: 'info',
};

/** 카드 텍스트가 정답 필드를 포함하는지 비교 */
export function compareFields(
  e: NormalizedEvent,
  canonical: CanonicalCardFields,
  cardText: string,
): RawSmccIssue[] {
  const issues: RawSmccIssue[] = [];

  // KR 카드는 "English"(다른 언어) 뿐 아니라 "Korean"(한국어를 영어 단어로 잘못 적은 것)도
  // 정답과 다르다는 확실한 신호다.
  const contradictingLanguageLabels: Record<LanguageMode, string[]> = { KR: ['English', 'Korean'], EN: ['한국어'] };

  // 날짜/시간은 전용 validator(compareCardDate/compareCardTime)에서 정밀 비교.
  // 언어/프로그램명/지역은 SMCC 규칙상 strict field — 정답과 다르면 오류로 처리한다.
  // contradicts: 카드에 이 값이 보이면 "정답과 다른 값이 확실히 적혀 있다"는 뜻(진짜 불일치).
  // 없으면(=카드에서 정답도, 반대되는 값도 안 보이면) 실수인지 인식 실패인지 알 수 없으므로
  // 확신을 낮춰서 보여준다 — 카드 디자인 자체는 작은 글자·색배경 아이콘 값이 많아 OCR/비전
  // 추출이 통째로 놓치는 경우가 흔하기 때문("불일치"라고 단정하면 안 된다).
  const checks: Array<{ label: string; value: string; severity: 'error' | 'warning' | 'info'; contradicts?: string[] }> = [
    { label: '언어', value: canonical.languageLabel, severity: 'error', contradicts: contradictingLanguageLabels[e.languageMode] },
    { label: '프로그램명', value: canonical.programName, severity: 'error' },
    { label: '지역', value: canonical.locationLabel, severity: 'error' },
    { label: '카페', value: e.cafeName, severity: 'warning' },
    { label: '호스트', value: canonical.hostLabel.replace(/^@/, ''), severity: 'info' },
  ];

  if (PROGRAM_CONFIG[e.programType].requiresDistance && canonical.distanceLabel) {
    checks.push({ label: '거리', value: canonical.distanceLabel, severity: 'warning' });
  }

  for (const c of checks) {
    if (!c.value.trim()) continue;
    if (has(cardText, c.value)) continue;

    const contradicted = (c.contradicts ?? []).some((alt) => has(cardText, alt));
    if (contradicted) {
      issues.push({
        category: 'source-mismatch',
        severity: c.severity,
        title: `${c.label} 불일치`,
        description: `카드에 정답과 다른 값이 표기돼 있습니다.`,
        expected: c.value,
        confidence: 0.85,
        resolutionHint: '원본/정답 값과 카드 표기를 비교하세요.',
      });
    } else {
      issues.push({
        category: 'source-mismatch',
        severity: DOWNGRADE[c.severity],
        title: `${c.label} 확인 필요`,
        description: `정답 값이 카드에서 확인되지 않았습니다. 실제로 빠졌는지, 자동 인식이 놓친 것뿐인지 직접 확인하세요.`,
        expected: c.value,
        confidence: 0.4,
        resolutionHint: '이미지에서 해당 항목을 직접 확인하세요.',
      });
    }
  }
  return issues;
}
