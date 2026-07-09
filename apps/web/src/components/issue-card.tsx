'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, Undo2 } from 'lucide-react';
import { Badge, Button, cn } from '@big/ui';
import type { DisplayIssue } from '@/lib/unify-issues';

const SEVERITY_TONE = { error: 'danger', warning: 'warning', info: 'neutral' } as const;
const SEVERITY_LABEL = { error: '오류', warning: '경고', info: '확인' } as const;

export function IssueCard({
  issue,
  resolved,
  onToggle,
}: {
  issue: DisplayIssue;
  resolved: boolean;
  onToggle: (issueId: string, resolved: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = issue.suggestion ?? issue.source;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border p-3.5 transition',
        resolved ? 'border-slate-200 bg-slate-50/60 opacity-60' : 'border-slate-200 bg-white',
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="brand">{issue.categoryLabel}</Badge>
        <Badge tone={SEVERITY_TONE[issue.severity]}>{SEVERITY_LABEL[issue.severity]}</Badge>
        <span className="text-xs text-slate-400">{issue.scope}</span>
      </div>

      <p className="mt-2.5 text-sm font-medium text-slate-800">
        <span className="text-slate-400">원문&nbsp;·&nbsp;</span>
        {issue.source}
      </p>
      {issue.suggestion && (
        <p className="mt-1 text-sm text-brand-700">
          <span className="text-slate-400">제안&nbsp;·&nbsp;</span>
          {issue.suggestion}
        </p>
      )}
      <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-500">
        {issue.explanation}
      </p>

      {issue.sources && issue.sources.length > 0 && (
        <ul className="mt-2 space-y-1">
          {issue.sources.map((s, i) => (
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
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          variant={resolved ? 'outline' : 'secondary'}
          onClick={() => onToggle(issue.id, !resolved)}
        >
          {resolved ? (
            <>
              <Undo2 className="h-3.5 w-3.5" /> 되돌리기
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" /> 완료 처리
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
