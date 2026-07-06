'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import type { ChecklistItem } from '@big/shared';

export function Checklist({ items }: { items: ChecklistItem[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.key} className="flex items-start gap-2.5">
          {item.passed ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          ) : (
            <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300 dark:text-slate-600" />
          )}
          <div>
            <p
              className={`text-sm font-medium ${
                item.key === 'ready' ? 'text-brand-700 dark:text-brand-300' : ''
              }`}
            >
              {item.label}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{item.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
