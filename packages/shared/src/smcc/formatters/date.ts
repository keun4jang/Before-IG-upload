import { MONTH_EN, WEEKDAY_EN, WEEKDAY_KR } from '../constants';

export interface ParsedDate {
  iso: string | null; // YYYY-MM-DD
  year: number | null;
  month: number | null; // 1-12
  day: number | null;
  weekdayFromText: number | null; // 0=일 ~ 6=토, 원본 텍스트에 적힌 요일
}

const EN_WEEKDAY_MAP: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

/** 원본 텍스트에서 요일 추출 */
export function weekdayFromText(raw: string): number | null {
  const kr = raw.match(/([일월화수목금토])요일/);
  if (kr) return WEEKDAY_KR.indexOf(kr[1]!);
  const en = raw.toLowerCase().match(/\b(sun|mon|tue|wed|thu|fri|sat)/);
  if (en) return EN_WEEKDAY_MAP[en[1]!] ?? null;
  return null;
}

/**
 * 유연한 날짜 파서. 연도가 없으면 refDate 기준으로 가장 가까운 미래 연도를 추정.
 */
export function parseDate(raw: string, refDate = new Date()): ParsedDate {
  const text = (raw ?? '').trim();
  const wd = weekdayFromText(text);
  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;

  // 1) ISO / dotted: 2026-07-12, 2026.07.12, 2026. 7. 12
  const iso = text.match(/(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  }

  // 2) Korean: 7월 8일
  if (month == null) {
    const kr = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    if (kr) {
      month = Number(kr[1]);
      day = Number(kr[2]);
    }
  }

  // 3) English: Jul 8 / Jul 8th
  if (month == null) {
    const en = text.match(/([A-Za-z]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?/);
    if (en) {
      const mi = MONTH_EN.findIndex((m) => m.toLowerCase() === en[1]!.slice(0, 3).toLowerCase());
      if (mi >= 0) {
        month = mi + 1;
        day = Number(en[2]);
      }
    }
  }

  // 4) 연도 없으면 추정
  if (month != null && day != null && year == null) {
    const ry = refDate.getFullYear();
    const cand = new Date(Date.UTC(ry, month - 1, day));
    const refUtc = Date.UTC(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
    // 과거로 180일 이상 벌어지면 내년으로
    year = cand.getTime() < refUtc - 180 * 86400000 ? ry + 1 : ry;
  }

  let isoStr: string | null = null;
  if (year != null && month != null && day != null) {
    isoStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return { iso: isoStr, year, month, day, weekdayFromText: wd };
}

/** iso(YYYY-MM-DD) → 실제 요일 (0=일) */
export function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}

/** KR 라벨: "7월 3일 금요일" */
export function formatDateKr(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return `${m}월 ${d}일 ${WEEKDAY_KR[dow]}요일`;
}

/** EN 라벨: "Jul 3rd, Fri" */
export function formatDateEn(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return `${MONTH_EN[m! - 1]} ${ordinal(d!)}, ${WEEKDAY_EN[dow]}`;
}
