import { FOREIGN_CITY_MARKERS, LOCATIONS, WEEKDAY_KR } from '../constants';
import type { NormalizedEvent, RawSmccIssue } from '../schemas';

function norm(s: string): string {
  return (s ?? '').toLowerCase();
}

/**
 * [지역 ↔ 주소 교차검증]
 * 카드/원본의 지역 라벨과 실제 주소가 다른 도시/국가를 가리키면 오류.
 * 예: 지역 "멜버른"인데 주소가 싱가포르(Tiong Bahru / River Valley) → 오류.
 */
export function validateAddressRegion(e: NormalizedEvent, cardText: string): RawSmccIssue[] {
  const issues: RawSmccIssue[] = [];
  const address = norm([e.cafeAddress, e.meetupSpotAddress, cardText].filter(Boolean).join(' '));
  if (!address.trim()) return issues;

  const region = LOCATIONS.find((l) =>
    l.match.some((m) => norm(e.locationRaw).includes(norm(m)) || norm(e.locationCanonicalKr).includes(norm(m))),
  );
  if (!region) return issues;

  const hasOwnMarker = region.addressMarkers.some((m) => address.includes(norm(m)));

  // 다른 알려진 지역의 마커가 있는가?
  const otherRegion = LOCATIONS.find(
    (l) => l.kr !== region.kr && l.addressMarkers.some((m) => address.includes(norm(m))),
  );
  // 해외 도시 마커(싱가포르/도쿄 등)가 있는가?
  const foreign = FOREIGN_CITY_MARKERS.find((m) => address.includes(norm(m)));

  if (!hasOwnMarker && (otherRegion || foreign)) {
    const found = otherRegion ? otherRegion.kr : foreign!;
    issues.push({
      category: 'address-verification',
      severity: 'error',
      title: '지역 ↔ 주소 불일치',
      description: `지역은 "${region.kr}"인데 주소는 "${found}" 를 가리킵니다.`,
      expected: region.kr,
      actual: found,
      confidence: 0.8,
      resolutionHint: '지역 또는 주소 중 잘못된 쪽을 수정하세요.',
    });
  }
  return issues;
}

/**
 * [상단 요일 버튼 ↔ 날짜 요일]
 * 카드 상단 요일 버튼(Mon–Sun)과 날짜의 실제 요일이 다르면 오류.
 * weekdayButton: 0(일)~6(토), 미지정이면 검사 생략.
 */
export function validateWeekdayButton(
  e: NormalizedEvent,
  weekdayButton: number | null | undefined,
): RawSmccIssue[] {
  const issues: RawSmccIssue[] = [];
  if (weekdayButton == null || e.weekdayExpected == null) return issues;
  if (weekdayButton !== e.weekdayExpected) {
    issues.push({
      category: 'date-rule',
      severity: 'error',
      title: '요일 버튼 불일치',
      description: `상단 요일 버튼(${WEEKDAY_KR[weekdayButton]})과 날짜 요일(${WEEKDAY_KR[e.weekdayExpected]})이 다릅니다.`,
      expected: `${WEEKDAY_KR[e.weekdayExpected]}요일`,
      actual: `${WEEKDAY_KR[weekdayButton]}요일`,
      confidence: 0.95,
      resolutionHint: '상단 요일 버튼을 날짜에 맞게 수정하세요.',
    });
  }
  return issues;
}

const WEEKDAY_BUTTON_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const WEEKDAY_BUTTON_LABEL: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

/** 0=일 ~ 6=토(WEEKDAY_KR 인덱스)를 상단 버튼 표기(mon/tue/...)로 변환 */
const WEEKDAY_INDEX_TO_BUTTON = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * 상단 요일 버튼 OCR 결과. 버튼은 아이콘 스타일(연한 색·강조)이라 카드 전체 OCR로는 뭉개져서,
 * 호출부(workspace)에서 버튼 줄만 따로 두 방식으로 읽어 넘긴다:
 *  - cells: 7칸(0=Mon자리 ~ 6=Sun자리)을 한 칸씩 잘라 인식한 값(못 읽으면 null). 위치가 어긋난
 *    버튼(예: 3번째 칸이 Wed가 아니라 Tue)을 정확히 집어낸다.
 *  - tokens: 버튼 줄 전체를 한 번에 인식한 요일 토큰들(순서 있음). 같은 요일 중복을 잡는다.
 */
export interface WeekdayButtonScan {
  cells?: Array<string | null>;
  tokens?: string[];
}

const weekdayTypoIssue = (
  description: string,
  actual: string,
  confidence: number,
  resolutionHint: string,
): RawSmccIssue => ({
  category: 'date-rule',
  severity: 'error',
  title: '요일 버튼 오타',
  description,
  expected: WEEKDAY_BUTTON_ORDER.map((d) => WEEKDAY_BUTTON_LABEL[d]).join(' '),
  actual,
  confidence,
  resolutionHint,
});

/**
 * [상단 요일 버튼 자체의 오타] 카드 상단엔 항상 Mon~Sun 7개 버튼이 하나씩 순서대로 있어야 하는데,
 * 디자이너가 복사/붙여넣기하다가 한 요일을 두 번 넣고 다른 요일을 빠뜨리는 실수가 있다.
 * 예: "Mon Tue Tue Thu Fri Sat Sun" (3번째가 Wed가 아니라 Tue).
 * selectedWeekday(0=일~6=토, 날짜의 요일)를 알면 강조 버튼이 OCR에서 빠져도 보정 검사를 한다.
 */
export function scanWeekdayButtonRowTypo(
  scan: WeekdayButtonScan | undefined,
  selectedWeekday?: number | null,
): RawSmccIssue[] {
  if (!scan) return [];
  const label = (d: string) => WEEKDAY_BUTTON_LABEL[d] ?? d;

  // 1) 위치별 검사: n번째 칸이 그 자리 요일과 다른 valid 요일이면 확실한 오타.
  const cells = scan.cells ?? [];
  for (let i = 0; i < 7; i++) {
    const c = (cells[i] ?? '').toLowerCase();
    if (c && WEEKDAY_BUTTON_ORDER.includes(c) && c !== WEEKDAY_BUTTON_ORDER[i]) {
      const readable = cells.map((x, idx) => (x ? label(x) : label(WEEKDAY_BUTTON_ORDER[idx]!))).join(' ');
      return [
        weekdayTypoIssue(
          `${i + 1}번째 요일 버튼이 "${label(c)}" 입니다. "${label(WEEKDAY_BUTTON_ORDER[i]!)}" 여야 합니다.`,
          readable,
          0.85,
          `${i + 1}번째 버튼을 "${label(WEEKDAY_BUTTON_ORDER[i]!)}" 로 바꾸세요.`,
        ),
      ];
    }
  }

  // 2) 전체 토큰 검사(중복/누락).
  const days = (scan.tokens ?? [])
    .map((t) => t.toLowerCase())
    .filter((t) => WEEKDAY_BUTTON_ORDER.includes(t));
  if (days.length < 6) return []; // 절반도 못 읽었으면 판단 불가 — 오탐 방지.

  const counts = new Map<string, number>();
  for (const d of days) counts.set(d, (counts.get(d) ?? 0) + 1);
  const duplicated = [...counts.entries()].filter(([, c]) => c > 1).map(([d]) => d);
  const missing = WEEKDAY_BUTTON_ORDER.filter((d) => !counts.has(d));

  // 2a) 같은 요일이 두 번 이상 → 확실한 오타.
  if (duplicated.length > 0) {
    return [
      weekdayTypoIssue(
        `요일 버튼에 "${duplicated.map(label).join(', ')}" 이(가) 중복됩니다. 요일 버튼은 Mon~Sun이 하나씩만 있어야 합니다.`,
        days.map(label).join(' '),
        0.85,
        '중복된 요일을 빠진 요일로 바꾸세요.',
      ),
    ];
  }

  // 2b) 강조 버튼은 보통 OCR이 못 읽어 딱 하나가 빠져 보인다. 그 빠진 요일이 실제 선택(강조)
  //     요일과 다르면, 강조 안 된 자리 중 하나가 잘못 적힌 것이다.
  if (selectedWeekday != null && missing.length === 1) {
    const selectedButton = WEEKDAY_INDEX_TO_BUTTON[selectedWeekday];
    if (selectedButton && missing[0] !== selectedButton) {
      return [
        weekdayTypoIssue(
          `요일 버튼에 "${label(missing[0]!)}" 이(가) 빠져 있습니다. 요일 버튼은 Mon~Sun이 하나씩 있어야 합니다.`,
          days.map(label).join(' '),
          0.7,
          `빠진 "${label(missing[0]!)}" 요일이 있는지 확인하세요.`,
        ),
      ];
    }
  }

  return [];
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[m]![n]!;
}

/**
 * [코스 시작/끝 카페명 오타] (에스프레소 런: A → … → A 로 돌아옴)
 * 시작과 끝이 "거의 같은데 살짝 다른" 경우만 오타로 판정.
 * 완전히 다른 이름(A→B)은 정상 코스로 보고 건드리지 않는다(오탐 방지).
 * 예: THEECA → … → THECA (오타)
 */
export function validateRouteEndpoints(e: NormalizedEvent): RawSmccIssue[] {
  const issues: RawSmccIssue[] = [];
  if (!e.routeRaw) return issues;
  const stops = e.routeRaw
    .split(/→|->|➔|>|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (stops.length < 3) return issues; // 왕복 코스로 볼 수 있는 최소 길이
  const first = stops[0]!.toLowerCase().replace(/\s+/g, '');
  const last = stops[stops.length - 1]!.toLowerCase().replace(/\s+/g, '');
  if (first === last) return issues;
  const dist = levenshtein(first, last);
  const maxLen = Math.max(first.length, last.length);
  // 철자만 살짝 다른 경우(오타)만: 편집거리 1~2 이면서 길이의 30% 이내
  if (dist >= 1 && dist <= 2 && dist <= maxLen * 0.3) {
    issues.push({
      category: 'source-mismatch',
      severity: 'warning',
      title: '코스 시작/끝 카페명 오타 의심',
      description: `코스 시작("${stops[0]}")과 끝("${stops[stops.length - 1]}") 표기가 미세하게 다릅니다.`,
      expected: stops[0],
      actual: stops[stops.length - 1],
      confidence: 0.6,
    });
  }
  return issues;
}
