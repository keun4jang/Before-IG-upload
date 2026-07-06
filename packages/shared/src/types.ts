/**
 * 도메인 전역 타입 정의.
 * 이 파일은 web / worker / ui 전체에서 공유됩니다. (외부 의존성 없음)
 */

// ---------------------------------------------------------------------------
// 이슈 분류 체계
// ---------------------------------------------------------------------------

export type IssueCategory =
  | 'spelling' // 오타
  | 'spacing' // 띄어쓰기
  | 'grammar' // 문법
  | 'style' // 어색한 표현 / 톤
  | 'punctuation' // 문장 부호
  | 'consistency' // 숫자/단위/표기 일관성
  | 'duplication' // 중복 / 유사
  | 'fact' // 사실 검토 필요
  | 'risk'; // 금칙어 / 과장 / 고위험 표현

export type IssueSeverity = 'high' | 'medium' | 'low';

/** 분석 대상 범위 */
export type ScopeType = 'slide' | 'caption' | 'project';

/** 텍스트 내 위치 (문자 오프셋 기준) */
export interface TextLocation {
  scopeType: ScopeType;
  /** slide의 경우 slideNumber, caption의 경우 0 */
  scopeRefId: string;
  /** 원문 내 시작 오프셋 */
  start: number;
  /** 원문 내 끝 오프셋 */
  end: number;
  /** 참고용 발췌 */
  excerpt: string;
}

export interface Issue {
  id: string;
  scopeType: ScopeType;
  scopeRefId: string;
  category: IssueCategory;
  severity: IssueSeverity;
  /** 0~1. 규칙 기반 신뢰도 */
  confidence: number;
  /** 문제가 된 원문 */
  sourceText: string;
  /** 제안 문구 (없을 수 있음) */
  suggestedText?: string;
  /** 사람이 읽는 설명 */
  explanation: string;
  location?: TextLocation;
  /** 사실 검토 이슈에 연결되는 claim (category === 'fact') */
  claim?: ClaimCheck;
  /** 사용자가 "수정 완료 처리" 했는지 */
  isResolved: boolean;
}

/** 아직 id/해결여부가 할당되지 않은 이슈 (detector 출력용) */
export type RawIssue = Omit<Issue, 'id' | 'isResolved'>;

// ---------------------------------------------------------------------------
// 사실 검토
// ---------------------------------------------------------------------------

export type ClaimVerdict =
  | 'mostly_supported' // 대체로 일치
  | 'partially_unclear' // 일부 불명확
  | 'insufficient_evidence' // 근거 부족
  | 'conflicting' // 상충되는 정보 있음
  | 'review_needed'; // 검토 필요 (기본값 / 근거 미수집)

export type ClaimDomain =
  | 'statistic'
  | 'date'
  | 'ranking'
  | 'medical'
  | 'legal'
  | 'financial'
  | 'entity'
  | 'general';

export interface EvidenceSource {
  title: string;
  url: string;
  snippet: string;
  sourceType?: string;
}

export interface ClaimCheck {
  claimText: string;
  domain: ClaimDomain;
  /** 고위험 영역(의료/법률/금융) 여부 → UI에서 더 보수적으로 안내 */
  highRisk: boolean;
  verdict: ClaimVerdict;
  rationale: string;
  confidence: number;
  sources: EvidenceSource[];
  checkedAt: string; // ISO
}

// ---------------------------------------------------------------------------
// 중복/유사
// ---------------------------------------------------------------------------

export type DuplicationKind = 'exact' | 'normalized' | 'similar' | 'intentional';

export interface DuplicationPair {
  kind: DuplicationKind;
  similarity: number; // 0~1
  a: { scopeRefId: string; text: string; start: number; end: number };
  b: { scopeRefId: string; text: string; start: number; end: number };
}

export interface KeywordFrequency {
  keyword: string;
  count: number;
}

// ---------------------------------------------------------------------------
// 분석 입력 / 출력
// ---------------------------------------------------------------------------

export interface SlideInput {
  slideNumber: number;
  /** OCR 원문 또는 사용자 수정 텍스트 */
  text: string;
  ocrConfidence?: number;
}

export interface AnalysisInput {
  slides: SlideInput[];
  captionText?: string;
  /** 사실 검토 활성화 여부 (search/LLM provider 유무에 따라) */
  factCheckEnabled?: boolean;
}

export type ScoreLabel = 'good' | 'review' | 'fix';

export interface AnalysisScore {
  overall: number; // 0~100
  label: ScoreLabel;
  perSlide: Array<{ slideNumber: number; score: number }>;
  captionScore?: number;
}

export interface SeverityDistribution {
  high: number;
  medium: number;
  low: number;
}

export interface AnalysisSummary {
  totalIssues: number;
  byCategory: Record<IssueCategory, number>;
  bySeverity: SeverityDistribution;
  claimCount: number;
  duplicatePairCount: number;
  topKeywords: KeywordFrequency[];
}

export interface AnalysisResult {
  issues: Issue[];
  duplicationPairs: DuplicationPair[];
  score: AnalysisScore;
  summary: AnalysisSummary;
  /** 업로드 전 최종 체크리스트 */
  checklist: ChecklistItem[];
  generatedAt: string; // ISO
}

export interface ChecklistItem {
  key: 'spelling' | 'duplication' | 'fact' | 'caption' | 'ready';
  label: string;
  passed: boolean;
  detail: string;
}

// ---------------------------------------------------------------------------
// 영속 모델 (in-memory / prisma 공통 shape)
// ---------------------------------------------------------------------------

export type ProjectStatus = 'draft' | 'analyzing' | 'analyzed' | 'archived';

export interface Project {
  id: string;
  name: string;
  description: string;
  notes: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  projectId: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
  sortOrder: number;
  /** 데모/미리보기용 data URL 또는 공개 URL */
  previewUrl?: string;
}

export interface Slide {
  id: string;
  projectId: string;
  assetId: string;
  slideNumber: number;
  ocrRawText: string;
  ocrEditedText: string | null;
  ocrConfidence: number | null;
  textBlocks: TextBlock[];
}

export interface TextBlock {
  text: string;
  bbox: { x: number; y: number; w: number; h: number }; // 0~1 정규화
  confidence: number;
}

export interface CaptionDraft {
  id: string;
  projectId: string;
  originalText: string;
  editedText: string | null;
}

export type AnalysisRunStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface AnalysisRun {
  id: string;
  projectId: string;
  status: AnalysisRunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  overallScore: number | null;
  error?: string;
  /** 파이프라인 진행 단계 (로딩 UX용) */
  progress?: AnalysisProgress;
  result?: AnalysisResult;
}

export type AnalysisStep =
  | 'prepare'
  | 'ocr'
  | 'normalize'
  | 'proofread'
  | 'duplication'
  | 'factcheck'
  | 'finalize';

export interface AnalysisProgress {
  step: AnalysisStep;
  /** 0~100 */
  percent: number;
  message: string;
}

export interface AppSettings {
  ocrProvider: string;
  llmProvider: string;
  searchProvider: string;
  storageDriver: string;
  factCheckEnabled: boolean;
  demoMode: boolean;
}
