'use client';

import { smcc } from '@big/shared';
import { CopyButton } from './copy-button';

/** 카드 "정답" 필드 — 필드별 복사 + 전체 복사/내보내기 */
export function CanonicalFields({ canonical }: { canonical: smcc.CanonicalCardFields }) {
  const rows = smcc.canonicalFieldList(canonical);
  const text = smcc.canonicalToText(canonical);

  function exportFile(kind: 'md' | 'json') {
    const content = kind === 'md' ? smcc.canonicalToMarkdown(canonical) : JSON.stringify(canonical, null, 2);
    const blob = new Blob([content], { type: kind === 'md' ? 'text/markdown' : 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `smcc-card.${kind}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">정답</span>
        <div className="flex items-center gap-1">
          <CopyButton text={text} label="전체 복사" />
          <button onClick={() => exportFile('md')} className="rounded-md px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            MD
          </button>
          <button onClick={() => exportFile('json')} className="rounded-md px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            JSON
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.key} className="group flex items-start gap-2 rounded-md border border-slate-100 bg-slate-50/60 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900/40">
            <span className="w-16 shrink-0 pt-0.5 text-xs text-slate-400">{r.label}</span>
            <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-100">{r.value}</span>
            <CopyButton text={r.value} label="" className="opacity-0 group-hover:opacity-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
