import { WEEKDAY_KR } from '../constants';
import { weekdayFromText } from '../formatters/date';
import type { NormalizedEvent, RawSmccIssue } from '../schemas';

/** 날짜 파싱 + 요일 일치 검사 */
export function validateEventDate(e: NormalizedEvent): RawSmccIssue[] {
  const issues: RawSmccIssue[] = [];

  if (!e.dateIso) {
    issues.push({
      category: 'date-rule',
      severity: 'info',
      title: '날짜 확인 필요',
      description: '원본 날짜를 해석하지 못했습니다.',
      actual: e.dateRaw,
      confidence: 0.4,
      resolutionHint: '원본 시트의 날짜 형식을 확인하세요.',
    });
    return issues;
  }

  const rawWd = weekdayFromText(e.dateRaw);
  if (rawWd != null && e.weekdayExpected != null && rawWd !== e.weekdayExpected) {
    issues.push({
      category: 'date-rule',
      severity: 'error',
      title: '요일 불일치',
      description: `${e.dateIso} 의 실제 요일은 ${WEEKDAY_KR[e.weekdayExpected]}요일입니다.`,
      expected: `${WEEKDAY_KR[e.weekdayExpected]}요일`,
      actual: `${WEEKDAY_KR[rawWd]}요일`,
      confidence: 0.95,
      resolutionHint: '날짜 또는 요일 표기를 수정하세요.',
    });
  }
  return issues;
}
