/**
 * 점수 계산: 100점에서 시작해 이슈 severity/category/confidence 가중치로 감점.
 */
import { CATEGORY_WEIGHT, scoreLabel, SEVERITY_WEIGHT } from '../constants';
import type {
  AnalysisScore,
  AnalysisSummary,
  Issue,
  IssueCategory,
  KeywordFrequency,
  SeverityDistribution,
} from '../types';

const ALL_CATEGORIES: IssueCategory[] = [
  'spelling',
  'spacing',
  'grammar',
  'style',
  'punctuation',
  'consistency',
  'duplication',
  'fact',
  'risk',
];

function deduction(issue: Issue): number {
  const base = SEVERITY_WEIGHT[issue.severity] * CATEGORY_WEIGHT[issue.category];
  // 신뢰도가 낮은 이슈는 감점 영향을 줄인다 (오탐 방어).
  const confidenceFactor = 0.5 + 0.5 * Math.max(0, Math.min(1, issue.confidence));
  return base * confidenceFactor;
}

function scoreFromIssues(issues: Issue[]): number {
  const total = issues.reduce((sum, i) => sum + deduction(i), 0);
  return Math.max(0, Math.round(100 - total));
}

export function computeScore(issues: Issue[], slideNumbers: number[]): AnalysisScore {
  const overall = scoreFromIssues(issues);

  const perSlide = slideNumbers.map((slideNumber) => {
    const slideIssues = issues.filter(
      (i) => i.scopeType === 'slide' && i.scopeRefId === String(slideNumber),
    );
    return { slideNumber, score: scoreFromIssues(slideIssues) };
  });

  const captionIssues = issues.filter((i) => i.scopeType === 'caption');
  const captionScore = captionIssues.length > 0 ? scoreFromIssues(captionIssues) : undefined;
  const hasCaptionScope = issues.some((i) => i.scopeType === 'caption');

  return {
    overall,
    label: scoreLabel(overall),
    perSlide,
    captionScore: hasCaptionScope ? scoreFromIssues(captionIssues) : captionScore,
  };
}

export function summarize(
  issues: Issue[],
  claimCount: number,
  duplicatePairCount: number,
  topKeywords: KeywordFrequency[],
): AnalysisSummary {
  const byCategory = Object.fromEntries(
    ALL_CATEGORIES.map((c) => [c, 0]),
  ) as Record<IssueCategory, number>;
  const bySeverity: SeverityDistribution = { high: 0, medium: 0, low: 0 };

  for (const issue of issues) {
    byCategory[issue.category] += 1;
    bySeverity[issue.severity] += 1;
  }

  return {
    totalIssues: issues.length,
    byCategory,
    bySeverity,
    claimCount,
    duplicatePairCount,
    topKeywords,
  };
}
