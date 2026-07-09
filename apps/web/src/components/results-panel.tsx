'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { DisplayIssue } from '@/lib/unify-issues';
import { IssueCard } from './issue-card';

export function ResultsPanel({
  issues,
  resolvedIds,
  onToggle,
}: {
  issues: DisplayIssue[];
  resolvedIds: Set<string>;
  onToggle: (issueId: string, resolved: boolean) => void;
}) {
  const [hideResolved, setHideResolved] = useState(false);

  const filtered = hideResolved ? issues.filter((i) => !resolvedIds.has(i.id)) : issues;

  return (
    <div className="flex h-full flex-col">
      <label className="flex items-center gap-1.5 text-xs text-slate-500">
        <input
          type="checkbox"
          checked={hideResolved}
          onChange={(e) => setHideResolved(e.target.checked)}
          className="rounded border-slate-300"
        />
        완료 항목 숨기기
      </label>

      <div className="mt-2 flex-1 space-y-2.5 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
            <CheckCircle2 className="h-9 w-9 text-emerald-400" />
            <p className="mt-3 text-sm">발견된 문제가 없어요.</p>
          </div>
        ) : (
          filtered.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              resolved={resolvedIds.has(issue.id)}
              onToggle={onToggle}
            />
          ))
        )}
      </div>
    </div>
  );
}
