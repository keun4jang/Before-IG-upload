import { PROGRAM_CONFIG } from '../program-config';
import { to12hLabel } from '../formatters/time';
import type { NormalizedEvent, RawSmccIssue } from '../schemas';

export function validateEventTime(e: NormalizedEvent): RawSmccIssue[] {
  const issues: RawSmccIssue[] = [];
  if (!e.startTime24h) {
    issues.push({
      category: 'time-rule',
      severity: 'info',
      title: '시작시간 확인 필요',
      description: '원본 시작시간을 해석하지 못했습니다.',
      actual: e.startTimeRaw,
      confidence: 0.4,
    });
  }
  return issues;
}

/** 카드에 적힌 종료시간이 (시작 + 프로그램 소요시간)과 다른지 검사 */
export function compareCardTime(e: NormalizedEvent, cardText: string): RawSmccIssue[] {
  const issues: RawSmccIssue[] = [];
  if (!e.startTime24h || !e.endTimeDerived24h) return issues;

  const expectedEnd = to12hLabel(e.endTimeDerived24h);
  const dur = PROGRAM_CONFIG[e.programType].durationMin;

  // 카드의 시간 범위 추출 (AM7:00–AM8:00 형태)
  const range = cardText.match(/([AP]M\s?\d{1,2}:\d{2})\s*[–\-~]\s*([AP]M\s?\d{1,2}:\d{2})/i);
  if (!range) return issues;
  const cardEnd = range[2]!.replace(/\s+/g, '').toUpperCase();
  const normExpected = expectedEnd.replace(/\s+/g, '').toUpperCase();

  if (cardEnd !== normExpected) {
    issues.push({
      category: 'time-rule',
      severity: 'error',
      title: '종료시간 불일치',
      description: `${e.programType} 소요시간 ${dur}분 기준 종료시간과 다릅니다.`,
      expected: normExpected,
      actual: cardEnd,
      confidence: 0.85,
      resolutionHint: '시작시간 기준 종료시간을 다시 계산하세요.',
    });
  }
  return issues;
}
