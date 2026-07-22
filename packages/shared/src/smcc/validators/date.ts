import { MONTH_EN, WEEKDAY_KR } from '../constants';
import { weekdayFromText } from '../formatters/date';
import type { NormalizedEvent, RawSmccIssue } from '../schemas';

/** 카드 텍스트에서 월/일 추출 (KR "M월 D일" 또는 EN "Jul 2nd") */
export function extractMonthDay(text: string): { month: number; day: number } | null {
  const kr = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (kr) return { month: Number(kr[1]), day: Number(kr[2]) };
  // 영문은 반드시 실제 월 이름으로 시작해야 한다 — 느슨하게 "단어+숫자"로 잡으면 "Min. 1"
  // (Drink) 같은 것에 먼저 걸려서 진짜 날짜("Jul 2nd")를 놓친다.
  const en = text.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i,
  );
  if (en) {
    const mi = MONTH_EN.findIndex((x) => x.toLowerCase() === en[1]!.toLowerCase());
    if (mi >= 0) return { month: mi + 1, day: Number(en[2]) };
  }
  return null;
}

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

/** 카드 텍스트의 날짜/요일이 원본과 일치하는지 검사 (이미지 OCR/입력 대비) */
export function compareCardDate(e: NormalizedEvent, cardText: string): RawSmccIssue[] {
  const issues: RawSmccIssue[] = [];
  if (!e.dateIso) return issues;
  const [, m, d] = e.dateIso.split('-').map(Number);

  const md = extractMonthDay(cardText);
  if (md && (md.month !== m || md.day !== d)) {
    issues.push({
      category: 'date-rule',
      severity: 'error',
      title: '날짜 불일치',
      description: '카드 날짜가 원본과 다릅니다.',
      expected: `${m}월 ${d}일`,
      actual: `${md.month}월 ${md.day}일`,
      confidence: 0.9,
    });
  }

  // 요일은 카드 전체가 아니라 "월/일"이 적힌 줄에서만 찾는다. 카드 상단엔 항상
  // "Mon Tue Wed Thu Fri Sat Sun" 같은 장식용 요일 선택 버튼 줄이 있는데, 이 줄까지 통째로
  // 검사하면 실제 선택된 요일과 상관없이 맨 앞 단어(Mon)가 걸려 매번 오탐이 난다.
  const dateLine = cardText.split('\n').find((line) => extractMonthDay(line) != null) ?? cardText;
  const cardWd = weekdayFromText(dateLine);
  if (cardWd != null && e.weekdayExpected != null && cardWd !== e.weekdayExpected) {
    issues.push({
      category: 'date-rule',
      severity: 'error',
      title: '요일 불일치',
      description: '카드 요일이 실제 날짜의 요일과 다릅니다.',
      expected: `${WEEKDAY_KR[e.weekdayExpected]}요일`,
      actual: `${WEEKDAY_KR[cardWd]}요일`,
      confidence: 0.9,
    });
  }
  return issues;
}
