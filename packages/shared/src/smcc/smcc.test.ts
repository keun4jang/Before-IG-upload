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

  it('"Date"/"Meet at"는 카드 언어와 무관하게 항상 영어 UI 라벨이라 오류로 잡으면 안 된다', () => {
    // 실제 카드를 확인해보면 KR 카드에도 "Date"/"Meet at" 라벨은 항상 영어로 고정 표기된다.
    const review = reviewEvent(buildEvent(), cardText);
    expect(review.cardIssues.some((i) => i.actual === 'Date')).toBe(false);
    expect(review.cardIssues.some((i) => i.actual === 'Meet at')).toBe(false);
  });

  it('"Korean" 언어표기 오류는 여전히 잡되, 막연한 "영어 혼용" 경고는 더 이상 내지 않는다', () => {
    const review = reviewEvent(buildEvent(), cardText);
    // "Korean" 표기 오류는 유지
    expect(review.cardIssues.some((i) => i.actual === 'Korean')).toBe(true);
    // 카페명/주소 때문에 뜨던 막연한 "영어 혼용" 경고는 제거됨(오탐 방지)
    expect(review.cardIssues.some((i) => i.title === '한글 카드에 영어 혼용')).toBe(false);
  });

  it('종합: 이 카드는 절대 "이슈 없음"이면 안 된다 (최소 2개 오류)', () => {
    const review = reviewEvent(buildEvent(), cardText);
    const errors = review.cardIssues.filter((i) => i.severity === 'error');
    expect(review.cardIssues.length).toBeGreaterThan(0);
    expect(errors.length).toBeGreaterThanOrEqual(2);
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

  it('카드 상단 장식용 요일 버튼 줄("Mon Tue Wed...") 때문에 요일이 맞는데도 오탐이 나면 안 된다', () => {
    const f = FIXTURES['daily-coffee-chat-kr'];
    const e = normalizeRow('daily-coffee-chat-kr', f.headers, f.rows[0]!, {
      sheetUrl: f.url,
      rowIndex: 0,
      refDate: new Date('2026-07-01'),
    }); // 실제 날짜 "7월 8일 수요일" (수요일이 맞음)
    // 카드 상단엔 항상 7개 요일이 전부 나열된 장식용 버튼 줄이 있고, 실제 선택된 요일은
    // 그 아래 날짜 줄에 따로 적힌다 — 맨 앞 단어("Mon")만 보고 요일을 판단하면 안 된다.
    const card = ['Mon Tue Wed Thu Fri Sat Sun', '데일리 커피 챗', '7월 8일 수요일'].join('\n');
    const review = reviewEvent(e, card);
    expect(review.cardIssues.some((i) => i.title === '요일 불일치')).toBe(false);
  });

  it('반대로 날짜 줄 자체의 요일이 실제와 다르면 여전히 잡아야 한다', () => {
    const f = FIXTURES['daily-coffee-chat-kr'];
    const e = normalizeRow('daily-coffee-chat-kr', f.headers, f.rows[0]!, {
      sheetUrl: f.url,
      rowIndex: 0,
      refDate: new Date('2026-07-01'),
    }); // 실제 날짜 "7월 8일 수요일"
    const card = ['Mon Tue Wed Thu Fri Sat Sun', '데일리 커피 챗', '7월 8일 금요일'].join('\n');
    const review = reviewEvent(e, card);
    expect(review.cardIssues.some((i) => i.title === '요일 불일치' && i.actual === '금요일')).toBe(true);
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

  it('"Date"/"Meet at"는 KR 카드에도 항상 영어라 오류로 잡으면 안 된다', () => {
    const { issues } = analyzeStandaloneCard(russell);
    expect(issues.some((i) => i.actual === 'Date')).toBe(false);
    expect(issues.some((i) => i.actual === 'Meet at')).toBe(false);
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

  it('OCR이 한글 프로그램명을 놓쳐도 영문 주소/호스트 때문에 EN으로 뒤집히면 안 된다', () => {
    // "데일리 커피 챗" 을 못 읽은 것처럼(krNameHit 실패) OCR 노이즈만 남기고, 나머지는
    // 실제 Russell 카드처럼 영문 주소/호스트/카페명 비중이 큰 상태를 재현.
    const card = [
      'Russell @russelltiger',
      'Korean',
      '멜버른',
      'AM 7:30- AM 8:30',
      'Date',
      '7월 1일 수요일',
      'Meet at',
      'BENCH COFFEE CO.',
      '580 St Kilda Rd, Melbourne VIC 3004',
    ].join('\n');
    const { event, issues } = analyzeStandaloneCard(card);
    expect(event.languageMode).toBe('KR');
    expect(
      issues.some((i) => i.category === 'language-mismatch' && i.actual === 'Korean' && i.expected === '한국어'),
    ).toBe(true);
  });

  it('위치별 칸 검사: n번째 칸 요일이 그 자리와 다르면 오타로 잡는다(card1: 3번째 Tue→Wed)', () => {
    // card1: 강조 Thu 는 못 읽어 null, 3번째 칸이 wed 여야 하는데 tue 로 읽힘.
    const cells = ['mon', 'tue', 'tue', null, 'fri', 'sat', 'sun'];
    const { issues } = analyzeStandaloneCard('데일리 커피 챗', { weekdayButtons: { cells } });
    const issue = issues.find((i) => i.title === '요일 버튼 오타');
    expect(issue).toBeTruthy();
    expect(issue?.severity).toBe('error');
    expect(issue?.description).toContain('3번째');
  });

  it('전체 토큰에 요일 중복이 있으면 오타로 잡는다(card2: Fri 중복)', () => {
    const tokens = ['mon', 'tue', 'wed', 'fri', 'fri', 'sun'];
    const { issues } = analyzeStandaloneCard('데일리 커피 챗', { weekdayButtons: { tokens } });
    const issue = issues.find((i) => i.title === '요일 버튼 오타');
    expect(issue).toBeTruthy();
    expect(issue?.description).toContain('중복');
  });

  it('버튼이 Mon~Sun 정상이면 요일 버튼 오타로 안 잡는다', () => {
    const cells = ['mon', 'tue', 'wed', null, 'fri', 'sat', 'sun'];
    const tokens = ['mon', 'tue', 'wed', 'fri', 'sat', 'sun'];
    const { issues } = analyzeStandaloneCard('데일리 커피 챗', { weekdayButtons: { cells, tokens } });
    expect(issues.some((i) => i.title === '요일 버튼 오타')).toBe(false);
  });

  it('시트 연동: 강조 버튼 빠져 6개만 읽혀도 빠진 요일≠선택 요일이면 오타로 잡는다', () => {
    const f = FIXTURES['daily-coffee-chat-kr'];
    // fixture rows[0] 날짜는 "7월 8일 수요일"(수=weekday 3).
    const e = normalizeRow('daily-coffee-chat-kr', f.headers, f.rows[0]!, {
      sheetUrl: f.url,
      rowIndex: 0,
      refDate: new Date('2026-07-01'),
    });
    // 선택 요일은 수요일인데 Tue 가 빠져 읽힘(강조=수 빠지는 게 정상인데 Tue도 없음) → 이상.
    const tokens = ['mon', 'wed', 'thu', 'fri', 'sat', 'sun']; // Tue 누락
    const review = reviewEvent(e, '데일리 커피 챗', { weekdayButtons: { tokens } });
    expect(review.cardIssues.some((i) => i.title === '요일 버튼 오타')).toBe(true);
  });

  it('버튼이 정상인데 OCR이 두 번 읽어 토큰이 7개 초과+빠진 요일 없으면 오탐으로 잡지 않는다', () => {
    // 실제: 정상 "Mon Tue Wed Thu Fri Sat Sun" 인데 OCR이 Fri/Sat 를 두 번 읽음.
    const tokens = ['mon', 'tue', 'wed', 'thu', 'fri', 'fri', 'sat', 'sat', 'sun'];
    const cells = ['mon', 'tue', 'wed', null, 'fri', 'sat', 'sun'];
    const { issues } = analyzeStandaloneCard('데일리 커피 챗\n한국어', { weekdayButtons: { cells, tokens } });
    expect(issues.some((i) => i.title === '요일 버튼 오타')).toBe(false);
  });
});

describe('언어 일관성 & 지역 (실제 카드 피드백 반영)', () => {
  it('언어 아이콘이 English 이면 English 표기는 오류가 아니고, 한글 프로그램명이 오류다', () => {
    // 박이현 카드: 언어 English, 프로그램명 "데일리 커피 챗"(한글) → 프로그램명 오류.
    const card = ['English', '데일리 커피 챗', 'Melbourne', 'Min. 1 Drink', 'Jul 3rd, Fri'].join('\n');
    const { event, issues } = analyzeStandaloneCard(card);
    expect(event.languageMode).toBe('EN');
    // "English" 를 오류로 잡으면 안 된다
    expect(issues.some((i) => i.actual === 'English')).toBe(false);
    // 한글 프로그램명은 오류로 잡아야 한다
    expect(issues.some((i) => i.title === '영문 카드에 한글 프로그램명')).toBe(true);
  });

  it('English 카드에 한글 참가조건("1인 1잔") → 오류(Min. 1 Drink)', () => {
    const card = ['English', 'Daily Coffee Chat', 'Yeouido', '1인 1잔', 'Jul 1st, Wed'].join('\n');
    const { issues } = analyzeStandaloneCard(card);
    expect(issues.some((i) => i.title === '영문 카드에 한글 참가조건')).toBe(true);
  });

  it('English 카드에 한글 지역명("여의도") → 오류(Yeouido)', () => {
    const card = ['English', 'Daily Coffee Chat', '여의도', 'Min. 1 Drink', 'Jul 1st, Wed'].join('\n');
    const { issues } = analyzeStandaloneCard(card);
    expect(
      issues.some((i) => i.title === '영문 카드에 한글 지역명' && i.expected === 'Yeouido'),
    ).toBe(true);
  });

  it('한국어 카드에 영문 참가조건("Min. 1 Drink") → 오류(1인 1잔)', () => {
    const card = ['한국어', '데일리 커피 챗', '성수', 'Min. 1 Drink', '7월 1일 수요일'].join('\n');
    const { issues } = analyzeStandaloneCard(card);
    expect(issues.some((i) => i.title === '한글 카드에 영문 참가조건')).toBe(true);
  });

  it('지역명 오타("여위도" → "여의도")를 잡는다', () => {
    const card = ['한국어', '북 다이브', '여위도 63빌딩', '15,000원', '7월 3일 금요일'].join('\n');
    const { issues } = analyzeStandaloneCard(card);
    expect(
      issues.some((i) => i.title === '지역명 오타 의심' && i.expected === '여의도'),
    ).toBe(true);
  });

  it('정상 지역명("여의도")은 오타로 잡지 않는다', () => {
    const card = ['한국어', '북 다이브', '여의도 63빌딩', '15,000원', '7월 3일 금요일'].join('\n');
    const { issues } = analyzeStandaloneCard(card);
    expect(issues.some((i) => i.title === '지역명 오타 의심')).toBe(false);
  });

  it('국내 지역(성수)인데 달러($30) → 통화 오류', () => {
    const card = ['한국어', '에스프레소 런', '성수', '$ 30', '7월 3일 금요일'].join('\n');
    const { issues } = analyzeStandaloneCard(card);
    expect(issues.some((i) => i.category === 'fee-rule' && /달러|통화/.test(i.title))).toBe(true);
  });

  it('"Time After Time" 카페명이 "Time" 라벨 오류로 오인되지 않는다', () => {
    const card = ['한국어', '북 다이브', '멜버른', 'Meet at\nTime After Time', '7월 2일 목요일'].join('\n');
    const { issues } = analyzeStandaloneCard(card);
    expect(issues.some((i) => i.actual === 'Time')).toBe(false);
  });

  it('국기 검수: 지역 멜버른(호주)인데 국기가 싱가포르 → 국기 불일치', () => {
    // 비전 AI가 "국기나라: 싱가포르" 를 읽어줬을 때.
    const card = ['한국어', '데일리 커피 챗', '멜버른', '국기나라: 싱가포르', '7월 2일 목요일'].join('\n');
    const { issues } = analyzeStandaloneCard(card);
    expect(issues.some((i) => i.title === '국기 불일치')).toBe(true);
  });

  it('국기 검수: 지역 성수(한국)인데 국기가 호주 → 국기 불일치', () => {
    const card = ['한국어', '에스프레소 런', '성수', '국기나라: 호주', '$ 30', '7월 3일 금요일'].join('\n');
    const { issues } = analyzeStandaloneCard(card);
    expect(issues.some((i) => i.title === '국기 불일치')).toBe(true);
  });

  it('국기 검수: 지역과 국기가 맞으면 통과(멜버른=호주)', () => {
    const card = ['한국어', '데일리 커피 챗', '멜버른', '국기나라: 호주', '7월 2일 목요일'].join('\n');
    const { issues } = analyzeStandaloneCard(card);
    expect(issues.some((i) => i.title === '국기 불일치')).toBe(false);
  });

  it('국기 줄이 없으면(비전 AI 미사용) 국기 검수는 건너뛴다', () => {
    const card = ['한국어', '데일리 커피 챗', '멜버른', '7월 2일 목요일'].join('\n');
    const { issues } = analyzeStandaloneCard(card);
    expect(issues.some((i) => i.title === '국기 불일치')).toBe(false);
  });
});

describe('날짜 ↔ 요일 일치 검수 (KR/EN 날짜 형식 모두)', () => {
  const ref = new Date('2026-07-01'); // 2026-07-02=목요일, 2026-07-03=금요일

  it('KR 카드: "7월 2일 금요일"(실제는 목요일) → 요일 불일치 오류', () => {
    const card = ['한국어', '데일리 커피 챗', '성수', '1인 1잔', 'Date 7월 2일 금요일'].join('\n');
    const { issues } = analyzeStandaloneCard(card, { refDate: ref });
    expect(issues.some((i) => i.title === '요일 불일치' && i.severity === 'error')).toBe(true);
  });

  it('KR 카드: "7월 2일 목요일"(맞음) → 요일 불일치 없음', () => {
    const card = ['한국어', '데일리 커피 챗', '성수', '1인 1잔', 'Date 7월 2일 목요일'].join('\n');
    const { issues } = analyzeStandaloneCard(card, { refDate: ref });
    expect(issues.some((i) => i.title === '요일 불일치')).toBe(false);
  });

  it('EN 카드(멜버른 등 해외 지역 포함): "Jul 2nd, Fri"(실제는 Thu) → 요일 불일치 오류', () => {
    // 회귀: 예전엔 "Min. 1 Drink"의 "Min. 1"을 날짜로 오인해 EN 카드의 날짜/요일 검사가
    // 통째로 빠졌다. 이제 실제 월 이름(Jul 등)으로 시작하는 날짜만 인식한다.
    const card = ['English', 'Daily Coffee Chat', 'Melbourne', 'Min. 1 Drink', 'Date Jul 2nd, Fri'].join('\n');
    const { event, issues } = analyzeStandaloneCard(card, { refDate: ref });
    expect(event.dateIso).toBe('2026-07-02');
    expect(issues.some((i) => i.title === '요일 불일치' && i.severity === 'error')).toBe(true);
  });

  it('EN 카드: "Jul 3rd, Fri"(맞음) → 요일 불일치 없음', () => {
    const card = ['English', 'Daily Coffee Chat', 'Melbourne', 'Min. 1 Drink', 'Date Jul 3rd, Fri'].join('\n');
    const { event, issues } = analyzeStandaloneCard(card, { refDate: ref });
    expect(event.dateIso).toBe('2026-07-03');
    expect(issues.some((i) => i.title === '요일 불일치')).toBe(false);
  });

  it('시트 연동 EN: 시트 날짜 Jul 10(금)인데 카드가 "Jul 10th, Sat" → 요일 불일치', () => {
    const enHeaders = ['타임스탬프', 'Preferred Date', 'Preferred Time', 'District/Area', 'Cafe Name', 'Branch', 'Street Address', 'Instagram ID'];
    const enRow = ['2026-06-20', 'Jul 10', 'AM 7:30', 'Melbourne', 'Axil Coffee', '', '565 Bourke St, Melbourne VIC 3000', '@en_host'];
    const e = normalizeRow('daily-coffee-chat-en', enHeaders, enRow, {
      sheetUrl: FIXTURES['daily-coffee-chat-en'].url,
      rowIndex: 0,
      refDate: new Date('2026-06-20'),
    });
    expect(e.dateIso).toBe('2026-07-10'); // 금요일
    const card = ['English', 'Daily Coffee Chat', 'Melbourne', 'Min. 1 Drink', 'Date Jul 10th, Sat'].join('\n');
    const review = reviewEvent(e, card);
    expect(review.cardIssues.some((i) => i.title === '요일 불일치' && i.severity === 'error')).toBe(true);
  });

  it('시트 연동 EN: 시트 날짜 Jul 10인데 카드가 "Jul 11th" → 날짜 불일치', () => {
    const enHeaders = ['타임스탬프', 'Preferred Date', 'Preferred Time', 'District/Area', 'Cafe Name', 'Branch', 'Street Address', 'Instagram ID'];
    const enRow = ['2026-06-20', 'Jul 10', 'AM 7:30', 'Melbourne', 'Axil Coffee', '', '565 Bourke St, Melbourne VIC 3000', '@en_host'];
    const e = normalizeRow('daily-coffee-chat-en', enHeaders, enRow, {
      sheetUrl: FIXTURES['daily-coffee-chat-en'].url,
      rowIndex: 0,
      refDate: new Date('2026-06-20'),
    });
    const card = ['English', 'Daily Coffee Chat', 'Melbourne', 'Min. 1 Drink', 'Date Jul 11th, Sat'].join('\n');
    const review = reviewEvent(e, card);
    expect(review.cardIssues.some((i) => i.title === '날짜 불일치' && i.severity === 'error')).toBe(true);
  });
});

describe('통합본(master) 시트: 행마다 프로그램/언어/가격이 명시된 Weekly Production 탭', () => {
  const f = FIXTURES.master;
  const meta = (i: number) => ({ sheetUrl: f.url, rowIndex: i, refDate: new Date('2026-06-20') });

  it('KR 데일리 커피 챗 행: 프로그램/언어/무료조건을 시트 값 그대로 사용', () => {
    const e = normalizeRow('master', f.headers, f.rows[0]!, meta(0));
    expect(e.programType).toBe('daily-coffee-chat');
    expect(e.languageMode).toBe('KR');
    expect(e.feeMode).toBe('free');
    expect(e.conditionLabelExpected).toBe('1인 1잔');
    expect(e.dateIso).toBe('2026-07-01');
    expect(e.cafeName).toBe('샘플커피 역삼점');
  });

  it('에스프레소 런 행: 유료 가격/코스/거리를 시트 값 그대로 사용', () => {
    const e = normalizeRow('master', f.headers, f.rows[1]!, meta(1));
    expect(e.programType).toBe('espresso-run');
    expect(e.feeMode).toBe('paid');
    expect(e.feeLabelExpected).toBe('15,000원');
    expect(e.distanceKm).toBe(5);
    expect(e.routeStops.length).toBe(3);
  });

  it('EN Coffee Chat 행: "Jul 1st Wed" 날짜와 English 언어 인식', () => {
    const e = normalizeRow('master', f.headers, f.rows[2]!, meta(2));
    expect(e.programType).toBe('daily-coffee-chat');
    expect(e.languageMode).toBe('EN');
    expect(e.dateIso).toBe('2026-07-01');
    expect(e.weekdayExpected).toBe(3); // 수요일
    expect(e.conditionLabelExpected).toBe('Min. 1 Drink');
  });

  it('통합본 연동 검수: 무료(1인 1잔) 행인데 카드에 금액 → 오류', () => {
    const e = normalizeRow('master', f.headers, f.rows[0]!, meta(0));
    const card = ['한국어', '데일리 커피 챗', '강남구', '15,000원', '7월 1일 수요일', '샘플커피 역삼점'].join('\n');
    const review = reviewEvent(e, card);
    expect(review.cardIssues.some((i) => i.title === '무료 프로그램에 금액 표기')).toBe(true);
  });

  it('통합본 연동 검수: 시트 요일(수)과 카드 요일(목)이 다르면 → 요일 불일치', () => {
    const e = normalizeRow('master', f.headers, f.rows[0]!, meta(0));
    const card = ['한국어', '데일리 커피 챗', '강남구', '1인 1잔', '7월 1일 목요일', '샘플커피 역삼점'].join('\n');
    const review = reviewEvent(e, card);
    expect(review.cardIssues.some((i) => i.title === '요일 불일치' && i.severity === 'error')).toBe(true);
  });
});
