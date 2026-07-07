'use client';

import { smcc } from '@big/shared';
import { cn } from '@big/ui';

export interface RowSummary {
  index: number;
  event: smcc.NormalizedEvent;
  errorCount: number;
  warnCount: number;
}

export function RowList({
  rows,
  selected,
  onSelect,
}: {
  rows: RowSummary[];
  selected: number | null;
  onSelect: (i: number) => void;
}) {
  if (rows.length === 0) {
    return <p className="px-1 py-4 text-xs text-slate-400">행 없음</p>;
  }
  return (
    <div className="space-y-1">
      {rows.map((r) => (
        <button
          key={r.index}
          onClick={() => onSelect(r.index)}
          className={cn(
            'w-full rounded-md border px-2.5 py-2 text-left transition',
            selected === r.index
              ? 'border-smcc-400 bg-smcc-50/70 dark:bg-smcc-900/20'
              : 'border-slate-200 hover:border-slate-300 dark:border-slate-800',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
              {r.event.cafeName || r.event.meetupSpotName || '(카페 미상)'}
            </span>
            <span className="flex shrink-0 gap-1">
              {r.errorCount > 0 && (
                <span className="rounded bg-rose-100 px-1 text-[11px] font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                  {r.errorCount}
                </span>
              )}
              {r.warnCount > 0 && (
                <span className="rounded bg-amber-100 px-1 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  {r.warnCount}
                </span>
              )}
            </span>
          </div>
          <div className="mt-0.5 flex gap-2 text-xs text-slate-400">
            <span>{r.event.dateLabelKr || r.event.dateRaw || '-'}</span>
            <span>{r.event.startTime24h ?? r.event.startTimeRaw}</span>
            <span className="truncate">{r.event.locationRaw}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
