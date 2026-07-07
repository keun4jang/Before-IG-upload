'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, Undo2 } from 'lucide-react';
import {
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  VERDICT_HINTS,
  VERDICT_LABELS,
  type Issue,
} from '@big/shared';
import { Badge, Button, cn } from '@big/ui';
import { severityTone, verdictTone } from '@/lib/format';

export function IssueCard({
  issue,
  onToggle,
}: {
  issue: Issue;
  onToggle: (issueId: string, resolved: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);

  function toggle() {
    onToggle(issue.id, !issue.isResolved);
  }

  async function copy() {
    const text = issue.suggestedText ?? issue.sourceText;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  const scopeLabel =
    issue.scopeType === 'caption'
      ? '캡션'
      : issue.scopeType === 'project'
        ? '전체'
        : `슬라이드 ${issue.scopeRefId}`;

  return (
    <div
      className={cn(
        'rounded-xl border p-3.5 transition',
        issue.isResolved
          ? 'border-slate-200 bg-slate-50/60 opacity-60 dark:border-slate-800 dark:bg-slate-900/40'
          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="brand">{CATEGORY_LABELS[issue.category]}</Badge>
        <Badge tone={severityTone[issue.severity]}>심각도 {SEVERITY_LABELS[issue.severity]}</Badge>
        <span className="text-xs text-slate-400">{scopeLabel}</span>
        <span className="ml-auto text-[11px] text-slate-400">
          신뢰도 {Math.round(issue.confidence * 100)}%
        </span>
      </div>

      <p className="mt-2.5 text-sm font-medium text-slate-800 dark:text-slate-100">
        <span className="text-slate-400">원문&nbsp;·&nbsp;</span>
        {issue.sourceText}
      </p>
      {issue.suggestedText && (
        <p className="mt-1 text-sm text-brand-700 dark:text-brand-300">
          <span className="text-slate-400">제안&nbsp;·&nbsp;</span>
          {issue.suggestedText}
        </p>
      )}
      <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {issue.explanation}
      </p>

      {issue.claim && (
        <div className="mt-3 rounded-lg bg-slate-50 p-2.5 dark:bg-slate-950/50">
          <div className="flex items-center gap-2">
            <Badge tone={verdictTone[issue.claim.verdict]}>
              {VERDICT_LABELS[issue.claim.verdict]}
            </Badge>
            {issue.claim.highRisk && <Badge tone="danger">고위험 영역</Badge>}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {VERDICT_HINTS[issue.claim.verdict]}
          </p>
          {issue.claim.sources.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {issue.claim.sources.map((s, i) => (
                <li key={i}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-slate-400">수집된 출처가 없습니다. 직접 확인이 필요합니다.</p>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant={issue.isResolved ? 'outline' : 'secondary'} onClick={toggle}>
          {issue.isResolved ? (
            <>
              <Undo2 className="h-3.5 w-3.5" /> 되돌리기
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" /> 수정 완료 처리
            </>
          )}
        </Button>
        <Button size="sm" variant="ghost" onClick={copy}>
          <Copy className="h-3.5 w-3.5" /> {copied ? '복사됨' : '복사'}
        </Button>
      </div>
    </div>
  );
}
