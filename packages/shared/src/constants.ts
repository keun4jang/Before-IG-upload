import type {
  ClaimVerdict,
  IssueCategory,
  IssueSeverity,
  ScoreLabel,
} from './types';

export const ANALYSIS_STEPS = [
  { step: 'prepare', label: '업로드 준비', percent: 5 },
  { step: 'ocr', label: 'OCR 추출', percent: 20 },
  { step: 'normalize', label: '텍스트 정리', percent: 35 },
  { step: 'proofread', label: '오타/문법 검사', percent: 55 },
  { step: 'duplication', label: '중복 탐지', percent: 72 },
  { step: 'factcheck', label: '사실 검토', percent: 90 },
  { step: 'finalize', label: '결과 정리', percent: 100 },
] as const;

/** 카테고리 한국어 라벨 */
export const CATEGORY_LABELS: Record<IssueCategory, string> = {
  spelling: '오타',
  spacing: '띄어쓰기',
  grammar: '문법',
  style: '표현/톤',
  punctuation: '문장부호',
  consistency: '표기 일관성',
  duplication: '중복/유사',
  fact: '사실 검토',
  risk: '과장/금칙어',
};

export const SEVERITY_LABELS: Record<IssueSeverity, string> = {
  high: '높음',
  medium: '중간',
  low: '낮음',
};

/** 점수 감점 가중치 (severity별) */
export const SEVERITY_WEIGHT: Record<IssueSeverity, number> = {
  high: 9,
  medium: 4,
  low: 1.5,
};

/** 카테고리별 추가 가중치 배수 */
export const CATEGORY_WEIGHT: Record<IssueCategory, number> = {
  spelling: 1,
  spacing: 0.8,
  grammar: 1.1,
  style: 0.7,
  punctuation: 0.5,
  consistency: 0.9,
  duplication: 1.2,
  fact: 1.4,
  risk: 1.3,
};

export const SCORE_LABELS: Record<ScoreLabel, string> = {
  good: '좋음',
  review: '검토 권장',
  fix: '수정 필요',
};

/** 사실 검토 verdict의 보수적 한국어 라벨 (절대 단정 금지) */
export const VERDICT_LABELS: Record<ClaimVerdict, string> = {
  mostly_supported: '대체로 일치 (근거 확인됨)',
  partially_unclear: '일부 불명확',
  insufficient_evidence: '근거 부족',
  conflicting: '상충되는 정보 있음',
  review_needed: '검토 필요',
};

export const VERDICT_HINTS: Record<ClaimVerdict, string> = {
  mostly_supported: '수집된 근거와 대체로 일치하나, 중요한 정보는 원출처 재확인을 권장합니다.',
  partially_unclear: '일부 표현이 근거와 다르게 해석될 수 있습니다. 출처를 다시 확인하세요.',
  insufficient_evidence: '근거 자료가 충분하지 않습니다. 공식 출처 확인을 권장합니다.',
  conflicting: '서로 다른 정보가 확인되었습니다. 최신·공식 출처로 재확인하세요.',
  review_needed: '자동 근거 수집이 비활성화되어 있거나 부족합니다. 직접 검토를 권장합니다.',
};

/** 전역 안전 안내 문구 */
export const SAFETY_NOTICE =
  'AI 기반 검토 결과이므로 참고용입니다. 중요한 정보, 특히 의료·법률·금융 관련 내용은 공식 출처를 다시 확인하세요.';

export function scoreLabel(score: number): ScoreLabel {
  if (score >= 85) return 'good';
  if (score >= 65) return 'review';
  return 'fix';
}
