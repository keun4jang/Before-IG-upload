'use client';

import { smcc } from '@big/shared';
import { cn } from '@big/ui';

export function SourceSelector({
  value,
  onChange,
}: {
  value: smcc.SheetType;
  onChange: (t: smcc.SheetType) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {smcc.SHEET_SOURCES.map((s) => (
        <button
          key={s.type}
          onClick={() => onChange(s.type)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition',
            value === s.type
              ? 'bg-smcc-500 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300',
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
