import type { LanguageMode, SheetType } from './schemas';

export const WEEKDAY_KR = ['일', '월', '화', '수', '목', '금', '토'];
export const WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTH_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** 지역 표준 표기 (KR/EN) + 국내여부 + 국가 + 주소에 나타나야 할 마커 */
export const LOCATIONS: Array<{
  kr: string;
  en: string;
  match: string[];
  domestic: boolean;
  /** 이 지역이 속한 나라(국기 검수용, 한글 표기) */
  country: string;
  /** 이 지역 카드의 주소에 통상 포함되는 토큰 (교차검증용) */
  addressMarkers: string[];
}> = [
  { kr: '성수', en: 'Seongsu', match: ['성수', 'seongsu'], domestic: true, country: '한국', addressMarkers: ['성수', '성동', '서울', 'seongsu', 'seongdong', 'seoul'] },
  { kr: '여의도', en: 'Yeouido', match: ['여의도', 'yeouido'], domestic: true, country: '한국', addressMarkers: ['여의도', '영등포', '서울', 'yeouido', 'yeongdeungpo', 'seoul'] },
  { kr: '멜버른', en: 'Melbourne', match: ['멜버른', 'melbourne'], domestic: false, country: '호주', addressMarkers: ['melbourne', 'vic'] },
  { kr: '시드니', en: 'Sydney', match: ['시드니', 'sydney'], domestic: false, country: '호주', addressMarkers: ['sydney', 'nsw'] },
];

/** 나라 이름 표기 정규화 (국기 검수: 비전이 뭐라고 부르든 한 형태로 맞춘다) */
export const COUNTRY_ALIASES: Record<string, string[]> = {
  한국: ['한국', '대한민국', 'korea', 'south korea', 'republic of korea', '🇰🇷'],
  호주: ['호주', '오스트레일리아', 'australia', '🇦🇺'],
  싱가포르: ['싱가포르', 'singapore', '🇸🇬'],
  일본: ['일본', 'japan', '🇯🇵'],
  미국: ['미국', 'usa', 'united states', 'america', '🇺🇸'],
  영국: ['영국', 'uk', 'united kingdom', 'britain', '🇬🇧'],
};

/** 해외 주소에서 나타나는 다른 국가/도시 마커 (지역↔주소 불일치 탐지 보조) */
export const FOREIGN_CITY_MARKERS = [
  'singapore', '싱가포르',
  'tokyo', '도쿄', '동경',
  'osaka', '오사카',
  'bangkok', '방콕',
  'taipei', '타이베이', '대만',
  'hongkong', 'hong kong', '홍콩',
  'london', '런던',
  'new york', 'newyork', '뉴욕',
];

export const LANGUAGE_LABEL: Record<LanguageMode, string> = {
  KR: '한국어',
  EN: 'English',
};

/** 무료 참가조건 라벨 */
export const CONDITION_LABEL: Record<LanguageMode, string> = {
  KR: '1인 1잔',
  EN: 'Min. 1 Drink',
};

/** 금지 표현(EN) */
export const FORBIDDEN_EN_CONDITION = ['Order 1 Drink'];

/** 달러 표기가 허용되는 지역(멜버른) */
export const USD_ALLOWED_LOCATIONS = ['멜버른', 'melbourne'];

export const SHEET_SOURCES: Array<{
  type: SheetType;
  label: string;
  url: string;
  /** 지정 시 이 제목의 탭만 사용(통합본처럼 작업용 탭이 많은 시트에서 정답 탭만 골라 읽기) */
  tabTitles?: string[];
}> = [
  {
    type: 'master',
    label: '통합본 (Weekly Master)',
    url: 'https://docs.google.com/spreadsheets/d/1iKClmdYBLd6Q1Bhiy40wjiCBsBPO4QmgGniCby13wVY/edit?gid=100#gid=100',
    tabTitles: ['Weekly Production'],
  },
  {
    type: 'espresso-run',
    label: 'Espresso Run',
    url: 'https://docs.google.com/spreadsheets/d/1jP2OvDt5R4PFk2oWZGYTakTnxqJysEUtpyA1uqWugoA/edit?usp=sharing',
  },
  {
    type: 'book-dive',
    label: 'Book Dive',
    url: 'https://docs.google.com/spreadsheets/d/1JYAe2H6reHq0Sp4ynJ_B6E-oYBjh3TntsRCiaL713Jk/edit?gid=1644650744#gid=1644650744',
  },
  {
    type: 'daily-coffee-chat-kr',
    label: 'Daily Coffee Chat (KR)',
    url: 'https://docs.google.com/spreadsheets/d/1jj6vIWF1nu0zwF_kJowGpUdqG_DknEjPfEEHPh8SwMU/edit?gid=878796051#gid=878796051',
  },
  {
    type: 'daily-coffee-chat-en',
    label: 'Daily Coffee Chat (EN)',
    url: 'https://docs.google.com/spreadsheets/d/10CPnc5Kcy1biFiN6ZU2IPhx-LRWUVDK6jqwxlrs8JWg/edit?gid=1126596545#gid=1126596545',
  },
];

/** 잘못된 통화 표기 패턴 (강한 오류) */
export const BAD_CURRENCY_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /\d[\d,]*\s*달러/, reason: '"달러" 한글 표기' },
  { re: /[\d,]+\s*\$(?!\d)/, reason: '금액 뒤에 $ 표기' },
  { re: /원\s*\d/, reason: '"원" 뒤에 숫자' },
  { re: /KRW\s*[\d,]+/i, reason: 'KRW 표기' },
  { re: /\d\s*원\s*\$/, reason: '원과 $ 혼용' },
];

export const SMCC_ISSUE_CATEGORY_LABEL: Record<string, string> = {
  'language-mismatch': '언어 혼용',
  'program-rule': '프로그램 규칙',
  'fee-rule': '참가비',
  'date-rule': '날짜/요일',
  'time-rule': '시간',
  'location-rule': '지역',
  'source-mismatch': '원본 불일치',
  'cafe-verification': '카페 확인',
  'address-verification': '주소 확인',
  duplicate: '중복',
  'manual-review': '확인 필요',
};

export const SMCC_SEVERITY_LABEL = {
  error: '오류',
  warning: '경고',
  info: '확인 필요',
} as const;
