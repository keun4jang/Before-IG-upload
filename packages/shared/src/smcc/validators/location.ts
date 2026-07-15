import { COUNTRY_ALIASES, FOREIGN_CITY_MARKERS, LOCATIONS } from '../constants';
import type { NormalizedEvent, RawSmccIssue } from '../schemas';

export function validateEventLocation(e: NormalizedEvent): RawSmccIssue[] {
  const issues: RawSmccIssue[] = [];
  if (!e.locationRaw.trim()) {
    issues.push({
      category: 'location-rule',
      severity: 'info',
      title: '지역 확인 필요',
      description: '원본 지역이 비어 있습니다.',
      confidence: 0.4,
    });
  }
  return issues;
}

/** 카드 지역 라벨이 언어에 맞는지 (EN 카드에 한글 지역명 등) */
export function compareCardLocation(e: NormalizedEvent, cardText: string): RawSmccIssue[] {
  const issues: RawSmccIssue[] = [];
  if (!e.locationCanonicalKr || !e.locationCanonicalEn) return issues;
  if (e.locationCanonicalKr === e.locationCanonicalEn) return issues; // 표준 매핑 없음
  const wrong = e.languageMode === 'EN' ? e.locationCanonicalKr : e.locationCanonicalEn;
  const right = e.languageMode === 'EN' ? e.locationCanonicalEn : e.locationCanonicalKr;
  if (cardText.includes(wrong) && !cardText.includes(right)) {
    issues.push({
      category: 'language-mismatch',
      severity: 'error',
      title: e.languageMode === 'EN' ? '영문 카드에 한글 지역명' : '한글 카드에 영문 지역명',
      description:
        e.languageMode === 'EN'
          ? `언어가 English인 카드입니다. 지역명도 영문 "${right}" 으로 표기하세요.`
          : `언어가 한국어인 카드입니다. 지역명도 한글 "${right}" 으로 표기하세요.`,
      expected: right,
      actual: wrong,
      confidence: 0.8,
      resolutionHint: `"${wrong}" → "${right}"`,
    });
  }
  return issues;
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

/** 나라 이름 문자열을 표준(한국/호주/...)으로 정규화. 모르면 원문 그대로. */
function normalizeCountry(raw: string): string {
  const s = raw.trim().toLowerCase();
  for (const [canonical, aliases] of Object.entries(COUNTRY_ALIASES)) {
    if (aliases.some((a) => s.includes(a.toLowerCase()))) return canonical;
  }
  return raw.trim();
}

/** 지역으로부터 기대되는 나라(국기 검수용). 모르면 null. */
function expectedCountry(e: NormalizedEvent, cardText: string): string | null {
  const loc = LOCATIONS.find((l) =>
    l.match.some(
      (m) =>
        e.locationRaw.toLowerCase().includes(m.toLowerCase()) ||
        e.locationCanonicalKr.toLowerCase().includes(m.toLowerCase()),
    ),
  );
  if (loc) return loc.country;
  // 주소/카드에 해외 도시 마커가 있으면 그 나라로 추정
  const hay = `${e.cafeAddress} ${cardText}`.toLowerCase();
  const marker = FOREIGN_CITY_MARKERS.find((m) => hay.includes(m.toLowerCase()));
  if (marker) return normalizeCountry(marker);
  return null;
}

/**
 * [국기 검수] 비전 AI가 읽어준 "국기나라: X" 값을 지역의 나라와 대조.
 * 예: 지역은 멜버른(호주)인데 국기가 싱가포르 → 오류. 비전 AI가 없으면(국기 줄 없음) 건너뜀.
 */
export function validateFlagCountry(e: NormalizedEvent, cardText: string): RawSmccIssue[] {
  const m = cardText.match(/국기나라\s*[:：]\s*([^\n]+)/);
  if (!m) return [];
  const flagCountry = normalizeCountry(m[1]!);
  const expected = expectedCountry(e, cardText);
  if (!expected) return [];
  if (normalizeCountry(expected) === flagCountry) return [];
  return [
    {
      category: 'location-rule',
      severity: 'error',
      title: '국기 불일치',
      description: `지역은 "${e.locationCanonicalKr || e.locationRaw}"(${expected})인데 국기는 "${flagCountry}" 입니다.`,
      expected: `${expected} 국기`,
      actual: `${flagCountry} 국기`,
      confidence: 0.8,
      resolutionHint: '지역에 맞는 국기로 바꾸세요.',
    },
  ];
}

/** 알려진 지역명(3자 이상)과 딱 한 글자 다른 토큰을 오타 의심으로 표시. 예: "여위도" → "여의도". */
const KNOWN_REGION_KR = LOCATIONS.map((l) => l.kr).filter((k) => k.length >= 3);
const ALL_REGION_KR = new Set(LOCATIONS.map((l) => l.kr));

export function scanRegionTypo(cardText: string): RawSmccIssue[] {
  const tokens = cardText.split(/[\s,·\n]+/).map((t) => t.replace(/[^가-힣]/g, ''));
  const seen = new Set<string>();
  for (const token of tokens) {
    if (token.length < 3 || token.length > 5) continue;
    if (ALL_REGION_KR.has(token) || seen.has(token)) continue;
    for (const region of KNOWN_REGION_KR) {
      if (Math.abs(token.length - region.length) > 1) continue;
      if (levenshtein(token, region) === 1) {
        seen.add(token);
        return [
          {
            category: 'location-rule',
            severity: 'warning',
            title: '지역명 오타 의심',
            description: `"${token}" 은(는) 지역명 "${region}" 의 오타로 보입니다.`,
            expected: region,
            actual: token,
            confidence: 0.7,
            resolutionHint: `"${token}" → "${region}"`,
          },
        ];
      }
    }
  }
  return [];
}
