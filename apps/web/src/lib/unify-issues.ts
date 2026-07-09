import type { Issue } from '@big/shared';
import { smcc, CATEGORY_LABELS } from '@big/shared';

/** 일반 검수(오타/중복/사실검토)와 SMCC 규칙 검수 결과를 하나의 형태로 통일 */
export interface DisplayIssue {
  id: string;
  categoryLabel: string;
  severity: 'error' | 'warning' | 'info';
  scope: string;
  source: string;
  suggestion?: string;
  explanation: string;
  sources?: Array<{ title: string; url: string }>;
}

const GENERAL_SEVERITY: Record<Issue['severity'], DisplayIssue['severity']> = {
  high: 'error',
  medium: 'warning',
  low: 'info',
};

function scopeLabel(scopeType: Issue['scopeType'], scopeRefId: string): string {
  if (scopeType === 'caption') return '캡션';
  if (scopeType === 'project') return '전체';
  return `슬라이드 ${scopeRefId}`;
}

export function fromGeneralIssue(i: Issue): DisplayIssue {
  return {
    id: i.id,
    categoryLabel: CATEGORY_LABELS[i.category],
    severity: GENERAL_SEVERITY[i.severity],
    scope: scopeLabel(i.scopeType, i.scopeRefId),
    source: i.sourceText,
    suggestion: i.suggestedText,
    explanation: i.explanation,
    sources: i.claim?.sources.map((s) => ({ title: s.title, url: s.url })),
  };
}

export function fromSmccIssue(scope: string, i: smcc.SmccIssue): DisplayIssue {
  return {
    id: i.id,
    categoryLabel: smcc.SMCC_ISSUE_CATEGORY_LABEL[i.category] ?? i.category,
    severity: i.severity,
    scope,
    source: i.actual ?? i.title,
    suggestion: i.expected,
    explanation: i.description,
  };
}

const SEVERITY_ORDER: Record<DisplayIssue['severity'], number> = { error: 0, warning: 1, info: 2 };

export function sortIssues(issues: DisplayIssue[]): DisplayIssue[] {
  return issues.slice().sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
