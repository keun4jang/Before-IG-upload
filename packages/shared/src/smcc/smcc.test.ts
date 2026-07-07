import { describe, expect, it } from 'vitest';
import { parseDate, formatDateKr, formatDateEn, weekdayOf } from './formatters/date';
import { parseTime, addMinutes, formatTimeLabel, to12hLabel } from './formatters/time';
import { krw, usd } from './formatters/money';
import { resolveFee, programName } from './formatters/labels';
import { scanBadCurrency } from './validators/fee';
import { matchPlace, scorePlace } from './validators/place-match';
import { normalizeRow } from './engine/normalize-event';
import { buildCanonicalCard } from './engine/build-canonical-card';
import { reviewEvent } from './index';
import { FIXTURES } from './fixtures';

describe('date formatters', () => {
  it('연도 포함 날짜를 파싱한다', () => {
    const p = parseDate('2026.07.12 일요일');
    expect(p.iso).toBe('2026-07-12');
  });
  it('연도 없는 날짜를 추정한다', () => {
    const p = parseDate('7월 8일 수요일', new Date('2026-07-01'));
    expect(p.iso).toBe('2026-07-08');
  });
  it('KR/EN 라벨을 만든다', () => {
    // 2026-07-03 실제 요일로 라벨 생성
    const kr = formatDateKr('2026-07-03');
    const en = formatDateEn('2026-07-03');
    const dow = weekdayOf('2026-07-03');
    expect(kr.startsWith('7월 3일')).toBe(true);
    expect(en.startsWith('Jul 3rd')).toBe(true);
    expect([kr, en, String(dow)].every(Boolean)).toBe(true);
  });
});

describe('time formatters', () => {
  it('AM/PM 시간을 24h로 파싱', () => {
    expect(parseTime('AM 8:00')).toBe('08:00');
    expect(parseTime('AM7:00')).toBe('07:00');
    expect(parseTime('PM 1:30')).toBe('13:30');
  });
  it('종료시간 계산', () => {
    expect(addMinutes('07:00', 120)).toBe('09:00');
    expect(addMinutes('06:30', 90)).toBe('08:00');
  });
  it('12h 라벨/범위', () => {
    expect(to12hLabel('09:00')).toBe('AM9:00');
    expect(formatTimeLabel('07:00', '09:00')).toBe('AM7:00–AM9:00');
  });
});

describe('money & fee rules', () => {
  it('통화 포맷', () => {
    expect(krw(15000)).toBe('15,000원');
    expect(usd(30)).toBe('$30');
  });
  it('에스프레소런 KR 참가비: 카페 수 기준', () => {
    expect(resolveFee('espresso-run', 'KR', 1).feeLabelExpected).toBe('15,000원');
    expect(resolveFee('espresso-run', 'KR', 2).feeLabelExpected).toBe('20,000원');
    expect(resolveFee('espresso-run', 'EN', 2).feeLabelExpected).toBe('$30');
  });
  it('북다이브 EN 유료 $25, KR 무료', () => {
    expect(resolveFee('book-dive', 'EN', 1).feeLabelExpected).toBe('$25');
    expect(resolveFee('book-dive', 'KR', 1).feeMode).toBe('free');
  });
  it('무료 프로그램 조건 라벨', () => {
    expect(resolveFee('daily-coffee-chat', 'KR', 1).feeLabelExpected).toBe('1인 1잔');
    expect(resolveFee('daily-coffee-chat', 'EN', 1).feeLabelExpected).toBe('Min. 1 Drink');
  });
  it('프로그램명 매핑', () => {
    expect(programName('daily-coffee-chat', 'KR')).toBe('데일리 커피 챗');
    expect(programName('espresso-run', 'EN')).toBe('Espresso Run');
  });
  it('잘못된 통화 표기 감지', () => {
    expect(scanBadCurrency('참가비 15000달러').length).toBeGreaterThan(0);
    expect(scanBadCurrency('20,000$').length).toBeGreaterThan(0);
    expect(scanBadCurrency('KRW 15,000').length).toBeGreaterThan(0);
    expect(scanBadCurrency('참가비 15,000원').length).toBe(0);
  });
});

describe('place-match', () => {
  it('토큰 겹침 점수', () => {
    expect(scorePlace('Seven Seeds Coffee', 'Seven Seeds Coffee Roasters, Carlton')).toBeGreaterThan(0.5);
  });
  it('후보 없으면 검증 불가', () => {
    expect(matchPlace('메쉬커피', []).verdict).toBe('not-verifiable');
  });
});

describe('normalize + canonical (fixtures)', () => {
  it('에스프레소런: 유료 2만원, 거리 6km, 종료 AM9:00', () => {
    const f = FIXTURES['espresso-run'];
    const e = normalizeRow('espresso-run', f.headers, f.rows[0]!, { sheetUrl: f.url, rowIndex: 0, refDate: new Date('2026-07-01') });
    expect(e.programType).toBe('espresso-run');
    expect(e.feeMode).toBe('paid');
    expect(e.feeLabelExpected).toBe('20,000원'); // 메쉬커피 → 센터커피 (2곳)
    expect(e.distanceKm).toBe(6);
    expect(e.startTime24h).toBe('07:00');
    expect(e.timeLabel).toBe('AM7:00–AM9:00');
    expect(e.routeStops.length).toBe(2);
  });

  it('북다이브 EN: $25, Book Dive, AM8:00–AM10:00', () => {
    const f = FIXTURES['book-dive'];
    const e = normalizeRow('book-dive', f.headers, f.rows[0]!, { sheetUrl: f.url, rowIndex: 0 });
    expect(e.languageMode).toBe('EN');
    expect(e.feeLabelExpected).toBe('$25');
    expect(e.timeLabel).toBe('AM8:00–AM10:00');
    const c = buildCanonicalCard(e);
    expect(c.programName).toBe('Book Dive');
    expect(c.locationLabel).toBe('Melbourne');
  });

  it('DCC KR: 요일 불일치 행에서 date-rule 오류', () => {
    const f = FIXTURES['daily-coffee-chat-kr'];
    const good = normalizeRow('daily-coffee-chat-kr', f.headers, f.rows[0]!, { sheetUrl: f.url, rowIndex: 0, refDate: new Date('2026-07-01') });
    const bad = normalizeRow('daily-coffee-chat-kr', f.headers, f.rows[1]!, { sheetUrl: f.url, rowIndex: 1, refDate: new Date('2026-07-01') });
    const goodReview = reviewEvent(good);
    const badReview = reviewEvent(bad);
    const goodDateErr = goodReview.issues.filter((i) => i.category === 'date-rule' && i.severity === 'error');
    const badDateErr = badReview.issues.filter((i) => i.category === 'date-rule' && i.severity === 'error');
    // 같은 날짜(7/8)에 대해 서로 다른 요일을 적었으므로 정확히 하나만 오류여야 함
    expect(goodDateErr.length + badDateErr.length).toBe(1);
  });

  it('카드 검수: 무료 프로그램에 금액 있으면 오류', () => {
    const f = FIXTURES['daily-coffee-chat-kr'];
    const e = normalizeRow('daily-coffee-chat-kr', f.headers, f.rows[0]!, { sheetUrl: f.url, rowIndex: 0, refDate: new Date('2026-07-01') });
    const review = reviewEvent(e, '데일리 커피 챗\n참가비 5,000원');
    expect(review.cardIssues.some((i) => i.category === 'fee-rule' && i.severity === 'error')).toBe(true);
  });
});
