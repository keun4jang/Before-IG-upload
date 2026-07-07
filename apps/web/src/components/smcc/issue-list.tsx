'use client';

import { smcc } from '@big/shared';
import { cn } from '@big/ui';

const SEV_STYLE: Record<smcc.SmccSeverity, string> = {
  error: 'border-l-rose-500 bg-rose-50/50 dark:bg-rose-950/20',
  warning: 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20',
  info: 'border-l-smcc-500 bg-smcc-50/60 dark:bg-smcc-900/10',
};
const SEV_LABEL: Record<smcc.SmccSeverity, string> = { error: '오류', warning: '경고', info: '확인 필요' };
const SEV_BADGE: Record<smcc.SmccSeverity, string> = {
  error: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  info: 'bg-smcc-100 text-smcc-700 dark:bg-smcc-900 dark:text-smcc-200',
};

export function IssueList({
  issues,
  resolved,
  onToggle,
}: {
  issues: smcc.SmccIssue[];
  resolved: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (issues.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">발견된 문제 없음</p>;
  }
  const order: smcc.SmccSeverity[] = ['error', 'warning', 'info'];
  const sorted = [...issues].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));

  return (
    <div className="space-y-2">
      {sorted.map((i) => {
        const isDone = resolved.has(i.id);
        return (
          <div
            key={i.id}
            className={cn(
              'rounded-md border border-l-2 border-slate-200 p-2.5 dark:border-slate-800',
              SEV_STYLE[i.severity],
              isDone && 'opacity-50',
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', SEV_BADGE[i.severity])}>
                {SEV_LABEL[i.severity]}
              </span>
              <span className="text-xs text-slate-400">{smcc.SMCC_ISSUE_CATEGORY_LABEL[i.category]}</span>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{i.title}</span>
              <button
                onClick={() => onToggle(i.id)}
                className="ml-auto rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {isDone ? '되돌리기' : '완료'}
              </button>
            </div>
            {i.description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{i.description}</p>}
            {(i.expected || i.actual) && (
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                {i.expected && (
                  <span className="text-slate-500">
                    정답 <span className="font-medium text-smcc-700 dark:text-smcc-300">{i.expected}</span>
                  </span>
                )}
                {i.actual && (
                  <span className="text-slate-500">
                    카드 <span className="font-medium text-rose-600 dark:text-rose-400">{i.actual}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
