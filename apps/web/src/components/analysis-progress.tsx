'use client';

import { Check, Loader2 } from 'lucide-react';
import { ANALYSIS_STEPS, type AnalysisProgress } from '@big/shared';
import { Progress } from '@big/ui';

export function AnalysisProgressView({ progress }: { progress?: AnalysisProgress }) {
  const currentPercent = progress?.percent ?? 0;

  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-600" />
      <h3 className="mt-4 text-lg font-semibold">검수를 진행하고 있어요</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {progress?.message ?? '잠시만 기다려주세요'}
      </p>
      <Progress value={currentPercent} className="mt-5" />
      <ul className="mt-6 space-y-2 text-left">
        {ANALYSIS_STEPS.map((step) => {
          const done = currentPercent >= step.percent;
          const active = !done && currentPercent >= step.percent - 20;
          return (
            <li
              key={step.step}
              className="flex items-center gap-2.5 text-sm"
              aria-current={active ? 'step' : undefined}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  done
                    ? 'bg-brand-600 text-white'
                    : active
                      ? 'bg-brand-100 text-brand-600 dark:bg-brand-950'
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                }`}
              >
                {done ? <Check className="h-3 w-3" /> : active ? <Loader2 className="h-3 w-3 animate-spin" /> : ''}
              </span>
              <span className={done || active ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
