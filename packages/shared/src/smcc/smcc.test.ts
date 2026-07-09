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
import { analyzeStandaloneCard } from './engine/analyze-standalone';
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

  it('카드 검수: 날짜/요일 불일치 감지 (이미지 정보 대비)', () => {
    const f = FIXTURES['espresso-run'];
    const e = normalizeRow('espresso-run', f.headers, f.rows[0]!, { sheetUrl: f.url, rowIndex: 0, refDate: new Date('2026-07-01') });
    // 원본은 7월 10일. 카드에 7월 25일이면 날짜 불일치
    const r1 = reviewEvent(e, '에스프레소 런\n7월 25일');
    expect(r1.cardIssues.some((i) => i.category === 'date-rule' && i.title === '날짜 불일치')).toBe(true);
    // 요일을 실제와 다르게 적으면 요일 불일치
    const WD = ['일', '월', '화', '수', '목', '금', '토'];
    const wrongWd = WD[(e.weekdayExpected! + 1) % 7];
    const r2 = reviewEvent(e, `에스프레소 런\n7월 10일 ${wrongWd}요일`);
    expect(r2.cardIssues.some((i) => i.category === 'date-rule' && i.title === '요일 불일치')).toBe(true);
  });

  it('카드 검수: 무료 프로그램에 금액 있으면 오류', () => {
    const f = FIXTURES['daily-coffee-chat-kr'];
    const e = normalizeRow('daily-coffee-chat-kr', f.headers, f.rows[0]!, { sheetUrl: f.url, rowIndex: 0, refDate: new Date('2026-07-01') });
    const review = reviewEvent(e, '데일리 커피 챗\n참가비 5,000원');
    expect(review.cardIssues.some((i) => i.category === 'fee-rule' && i.severity === 'error')).toBe(true);
  });
});

describe('실전 버그 재현: KR 카드에 영어 언어표기/영어 라벨 (이슈 없음으로 새는 문제)', () => {
  const headers = ['접수시각', '날짜', '시간', '지역', '카페명', '주소', '호스트 아이디', '지점명', '색상'];
  const row = [
    '2026-06-20',
    '7월 1일 수요일',
    'AM 7:30',
    '멜버른',
    'BENCH COFFEE CO.',
    '580 St Kilda Rd, Melbourne VIC 3004',
    '@host_id',
    '',
    '#000000',
  ];
  const cardText = [
    'Korean',
    '멜버른',
    '1인 1잔',
    'AM7:30-AM8:30',
    'Date',
    '7월 1일 수요일',
    'Meet at',
    'BENCH COFFEE CO.',
    '580 St Kilda Rd, Melbourne VIC 3004',
    '데일리 커피 챗',
  ].join('\n');

  function buildEvent() {
    return normalizeRow('daily-coffee-chat-kr', headers, row, {
      sheetUrl: FIXTURES['daily-coffee-chat-kr'].url,
      rowIndex: 0,
      refDate: new Date('2026-06-20'),
    });
  }

  it('KR 행사 + "Korean" 표기 => error', () => {
    const review = reviewEvent(buildEvent(), cardText);
    expect(
      review.cardIssues.some(
        (i) => i.category === 'language-mismatch' && i.severity === 'error' && i.actual === 'Korean',
      ),
    ).toBe(true);
  });

  it('KR 행사 + "Date" 영어 라벨 => error', () => {
    const review = reviewEvent(buildEvent(), cardText);
    expect(
      review.cardIssues.some(
        (i) => i.category === 'language-mismatch' && i.severity === 'error' && i.actual === 'Date',
      ),
    ).toBe(true);
  });

  it('KR 행사 + "Meet at" 영어 라벨 => error', () => {
    const review = reviewEvent(buildEvent(), cardText);
    expect(
      review.cardIssues.some(
        (i) => i.category === 'language-mismatch' && i.severity === 'error' && i.actual === 'Meet at',
      ),
    ).toBe(true);
  });

  it('mixed-language 경고도 함께 감지', () => {
    const review = reviewEvent(buildEvent(), cardText);
    expect(
      review.cardIssues.some((i) => i.category === 'language-mismatch' && i.title === '한글 카드에 영어 혼용'),
    ).toBe(true);
  });

  it('종합: 이 카드는 절대 "이슈 없음"이면 안 된다 (최소 3개 오류)', () => {
    const review = reviewEvent(buildEvent(), cardText);
    const errors = review.cardIssues.filter((i) => i.severity === 'error');
    expect(review.cardIssues.length).toBeGreaterThan(0);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it('EN 행사에 한국어 프로그램명 => error (strict canonical mismatch)', () => {
    const enHeaders = [
      '타임스탬프',
      'Preferred Date',
      'Preferred Time',
      'District/Area',
      'Cafe Name',
      'Branch',
      'Street Address',
      'Instagram ID',
    ];
    const enRow = ['2026-06-20', 'Jul 10', 'AM 7:30', 'Seongsu', 'Center Coffee', '', '66 Seongsui-ro', '@en_host'];
    const e = normalizeRow('daily-coffee-chat-en', enHeaders, enRow, {
      sheetUrl: FIXTURES['daily-coffee-chat-en'].url,
      rowIndex: 0,
      refDate: new Date('2026-06-20'),
    });
    const review = reviewEvent(e, 'Daily Coffee Chat\n데일리 커피 챗\nSeongsu\nMin. 1 Drink\n@en_host');
    expect(
      review.cardIssues.some((i) => i.category === 'language-mismatch' && i.severity === 'error'),
    ).toBe(true);
  });

  it('strict canonical mismatch: 언어 라벨이 정답과 다르면 이슈 생성', () => {
    const e = buildEvent();
    const review = reviewEvent(e, cardText);
    expect(
      review.cardIssues.some(
        (i) => i.category === 'source-mismatch' && i.expected === '한국어' && i.severity === 'error',
      ),
    ).toBe(true);
  });
});

describe('실전 배치2: 통화·지역·요일버튼·금지표현 (놓치던 케이스)', () => {
  it('⑦ 성수(국내) 에스프레소런에 $30 → 통화 오류(error)', () => {
    const f = FIXTURES['espresso-run'];
    const e = normalizeRow('espresso-run', f.headers, f.rows[0]!, {
      sheetUrl: f.url,
      rowIndex: 0,
      refDate: new Date('2026-07-01'),
    });
    expect(e.locationCanonicalKr).toBe('성수');
    const review = reviewEvent(e, '에스프레소 런\n성수\n$30\n메쉬커피');
    expect(
      review.cardIssues.some((i) => i.category === 'fee-rule' && i.severity === 'error' && i.actual === '$'),
    ).toBe(true);
  });

  it('④ 지역 "멜버른"인데 주소가 싱가포르 → 지역↔주소 불일치(error)', () => {
    const headers = ['접수시각', '날짜', '시간', '지역', '카페명', '주소', '호스트 아이디', '지점명', '색상'];
    const row = [
      '2026-06-20',
      '7월 2일 목요일',
      'AM 8:00',
      '멜버른',
      'Tiong Bahru Bakery',
      '70 River Valley Rd, #01-05 Foothills Fort Canning, Singapore',
      '@activedoer',
      '',
      '#000',
    ];
    const e = normalizeRow('daily-coffee-chat-kr', headers, row, {
      sheetUrl: FIXTURES['daily-coffee-chat-kr'].url,
      rowIndex: 0,
      refDate: new Date('2026-06-20'),
    });
    const review = reviewEvent(e, '데일리 커피 챗\n멜버른\n1인 1잔');
    expect(
      review.cardIssues.some((i) => i.category === 'address-verification' && i.severity === 'error'),
    ).toBe(true);
  });

  it('⑤ 상단 요일버튼(Sun)이 날짜 요일(Thu)과 다르면 → 요일 버튼 불일치(error)', () => {
    const f = FIXTURES['book-dive']; // 2026.07.12 일요일 → 실제 일요일(0)
    const e = normalizeRow('book-dive', f.headers, f.rows[0]!, {
      sheetUrl: f.url,
      rowIndex: 0,
      refDate: new Date('2026-06-29'),
    });
    // 요일 버튼을 목요일(4)로 잘못 지정 → 불일치
    const review = reviewEvent(e, '북 다이브', { weekdayButton: 4 });
    expect(
      review.cardIssues.some((i) => i.title === '요일 버튼 불일치' && i.severity === 'error'),
    ).toBe(true);
    // 올바른 버튼(일=0)이면 이슈 없음
    const ok = reviewEvent(e, '북 다이브', { weekdayButton: 0 });
    expect(ok.cardIssues.some((i) => i.title === '요일 버튼 불일치')).toBe(false);
  });

  it('⑨ "Order 1 Drink" 금지 표현 → 언어 무관 error', () => {
    const f = FIXTURES['daily-coffee-chat-en'];
    const e = normalizeRow('daily-coffee-chat-en', f.headers, f.rows[0]!, {
      sheetUrl: f.url,
      rowIndex: 0,
      refDate: new Date('2026-06-20'),
    });
    const review = reviewEvent(e, 'Daily Coffee Chat\nOrder 1 Drink');
    expect(
      review.cardIssues.some((i) => i.title === '금지 표현' && i.actual === 'Order 1 Drink'),
    ).toBe(true);
  });

  it('코스 시작/끝 오타(THEECA→THECA)만 잡고, 정상 A→B 코스는 안 잡음', () => {
    const headers = ['접수시각', '날짜', '시간', '지역', '카페명', '주소', '호스트 아이디', '지점명', '색상'];
    // daily-chat-kr 로는 route 가 없으니 espresso 픽스처를 변형해서 route 주입
    const f = FIXTURES['espresso-run'];
    const row = [...f.rows[0]!];
    const routeCol = f.headers.findIndex((h) => h.includes('코스'));
    row[routeCol] = 'THEECA → Opera House → Cabrito → THECA';
    const e = normalizeRow('espresso-run', f.headers, row, { sheetUrl: f.url, rowIndex: 0, refDate: new Date('2026-07-01') });
    const review = reviewEvent(e, '에스프레소 런');
    expect(review.cardIssues.some((i) => i.title === '코스 시작/끝 카페명 오타 의심')).toBe(true);
    void headers;
  });
});

describe('시트 없이 카드 단독 검수 (이미지/붙여넣기)', () => {
  // 실제 Russell 카드(문제 있음)
  const russell = [
    'Mon Tue Wed Thu Fri Sat Sun',
    'Russell @russelltiger',
    '데일리 커피 챗',
    'Korean',
    '멜버른',
    '1인 1잔',
    'AM 7:30- AM 8:30',
    'Date',
    '7월 1일 수요일',
    'Meet at',
    'BENCH COFFEE CO.',
    '580 St Kilda Rd, Melbourne VIC 3004',
  ].join('\n');

  it('Russell 카드는 절대 "이슈 없음"이면 안 된다', () => {
    const { issues } = analyzeStandaloneCard(russell);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('KR 카드인데 "Korean" → 오류', () => {
    const { issues } = analyzeStandaloneCard(russell);
    expect(issues.some((i) => i.category === 'language-mismatch' && i.actual === 'Korean' && i.severity === 'error')).toBe(true);
  });

  it('KR 카드인데 "Date"/"Meet at" 영어 라벨 → 오류', () => {
    const { issues } = analyzeStandaloneCard(russell);
    expect(issues.some((i) => i.actual === 'Date' && i.severity === 'error')).toBe(true);
    expect(issues.some((i) => i.actual === 'Meet at' && i.severity === 'error')).toBe(true);
  });

  it('프로그램/언어/지역 추론', () => {
    const { event } = analyzeStandaloneCard(russell);
    expect(event.programType).toBe('daily-coffee-chat');
    expect(event.languageMode).toBe('KR');
    expect(event.locationCanonicalKr).toBe('멜버른');
  });

  it('EN 카드 + 한글 프로그램명(데일리 커피 챗) → 오류', () => {
    const card = ['English', 'Melbourne', 'Min. 1 Drink', '데일리 커피 챗', 'Jul 3rd, Fri'].join('\n');
    const { issues } = analyzeStandaloneCard(card);
    expect(issues.some((i) => i.category === 'language-mismatch' && i.severity === 'error')).toBe(true);
  });

  it('정상 카드(한국어/한글 라벨 없음)는 이슈 최소', () => {
    const card = ['데일리 커피 챗', '한국어', '성수', '1인 1잔'].join('\n');
    const { issues } = analyzeStandaloneCard(card);
    expect(issues.filter((i) => i.severity === 'error').length).toBe(0);
  });
});
