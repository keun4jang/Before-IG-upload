/**
 * SMCC(서울모닝커피클럽) 도메인 타입.
 */

export type ProgramType =
  | 'espresso-run'
  | 'book-dive'
  | 'daily-coffee-chat'
  | 'rave'
  | 'glow-up';

export type LanguageMode = 'KR' | 'EN';

export type SheetType =
  | 'espresso-run'
  | 'book-dive'
  | 'daily-coffee-chat-kr'
  | 'daily-coffee-chat-en'
  /** 4개 시트를 합친 통합본(Weekly Announcement Master) — 행마다 프로그램/언어/가격이 명시됨 */
  | 'master';

export type FeeMode = 'free' | 'paid';

export interface RouteStop {
  name: string;
}

/** 시트 row → 공통 정규화 이벤트 */
export interface NormalizedEvent {
  id: string;
  sourceSheetType: SheetType;
  sourceSheetUrl: string;
  sourceRowIndex: number;

  programType: ProgramType;
  languageMode: LanguageMode;
  languageLabelExpected: string;

  locationRaw: string;
  locationCanonicalKr: string;
  locationCanonicalEn: string;

  dateRaw: string;
  dateIso: string | null; // YYYY-MM-DD
  weekdayExpected: number | null; // 0=일 ~ 6=토 (dateIso 기준 실제 요일)
  weekdayRaw: string; // 원본에 적힌 요일(있으면)
  dateLabelKr: string;
  dateLabelEn: string;

  startTimeRaw: string;
  startTime24h: string | null; // HH:MM
  endTimeDerived24h: string | null; // HH:MM
  timeLabel: string;

  meetupSpotName: string;
  meetupSpotAddress: string;
  cafeName: string;
  cafeBranch: string;
  cafeAddress: string;

  routeRaw: string;
  routeStops: RouteStop[];
  distanceKm: number | null;
  estimatedPace: string;

  hostInstagram: string;
  baggageStorage: string;
  notes: string;

  feeMode: FeeMode;
  feeLabelExpected: string;
  conditionLabelExpected: string;
  additionalInfoExpected: string[];

  raw: Record<string, string>;
}

/** 카드에 들어갈 "정답" 필드 세트 */
export interface CanonicalCardFields {
  programName: string;
  languageLabel: string;
  locationLabel: string;
  dateLabel: string;
  timeLabel: string;
  feeOrConditionLabel: string;
  distanceLabel: string;
  routeLabel: string;
  needsLabel: string;
  hostLabel: string;
}

export type SmccIssueCategory =
  | 'language-mismatch'
  | 'program-rule'
  | 'fee-rule'
  | 'date-rule'
  | 'time-rule'
  | 'location-rule'
  | 'source-mismatch'
  | 'cafe-verification'
  | 'address-verification'
  | 'duplicate'
  | 'manual-review';

export type SmccSeverity = 'error' | 'warning' | 'info';

export interface SmccIssue {
  id: string;
  category: SmccIssueCategory;
  severity: SmccSeverity;
  title: string;
  description: string;
  expected?: string;
  actual?: string;
  confidence: number; // 0~1
  resolutionHint?: string;
}

/** id 미할당 이슈 (validator 출력용) */
export type RawSmccIssue = Omit<SmccIssue, 'id'>;

/** 장소 교차확인 결과 */
export type PlaceVerdict =
  | 'likely-match'
  | 'possible-mismatch'
  | 'not-verifiable'
  | 'manual-review';

export interface PlaceCandidate {
  displayName: string;
  lat?: number;
  lon?: number;
  type?: string;
}

export interface PlaceVerification {
  query: string;
  verdict: PlaceVerdict;
  confidence: number;
  candidates: PlaceCandidate[];
  mapSearchUrl: string;
  webSearchUrl: string;
  note: string;
}
