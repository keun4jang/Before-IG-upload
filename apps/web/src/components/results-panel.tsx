'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { AnalysisResult, Issue, IssueCategory } from '@big/shared';
import { cn } from '@big/ui';
import { IssueCard } from './issue-card';

type TabKey = 'all' | 'proofread' | 'duplication' | 'fact' | 'caption';

const PROOFREAD_CATS: IssueCategory[] = [
  'spelling',
  'spacing',
  'grammar',
  'style',
  'punctuation',
  'consistency',
  'risk',
];

function matchesTab(issue: Issue, tab: TabKey): boolean {
  switch (tab) {
    case 'all':
      return true;
    case 'proofread':
      return PROOFREAD_CATS.includes(issue.category);
    case 'duplication':
      return issue.category === 'duplication';
    case 'fact':
      return issue.category === 'fact';
    case 'caption':
      return issue.scopeType === 'caption';
  }
}

export function ResultsPanel({
  result,
  onToggle,
}: {
  result: AnalysisResult;
  onToggle: (issueId: string, resolved: boolean) => void;
}) {
  const [tab, setTab] = useState<TabKey>('all');
  const [hideResolved, setHideResolved] = useState(false);

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { all: 0, proofread: 0, duplication: 0, fact: 0, caption: 0 };
    for (const issue of result.issues) {
      (Object.keys(c) as TabKey[]).forEach((k) => {
        if (matchesTab(issue, k)) c[k] += 1;
      });
    }
    return c;
  }, [result.issues]);

  const filtered = result.issues
    .filter((i) => matchesTab(i, tab))
    .filter((i) => (hideResolved ? !i.isResolved : true));

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'all', label: '전체' },
    { key: 'proofread', label: '오타' },
    { key: 'duplication', label: '중복' },
    { key: 'fact', label: '사실검토' },
    { key: 'caption', label: '캡션' },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2 dark:border-slate-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-medium transition',
              tab === t.key
                ? 'bg-brand-600 text-white'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800',
            )}
          >
            {t.label}
            <span className="ml-1 opacity-70">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      <label className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
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
            <p className="mt-3 text-sm">이 카테고리에서 발견된 이슈가 없어요.</p>
          </div>
        ) : (
          filtered.map((issue) => (
            <IssueCard key={issue.id} issue={issue} onToggle={onToggle} />
          ))
        )}
      </div>
    </div>
  );
}
