'use client';

import { CopyButton } from './copy-button';

export interface FieldRow {
  label: string;
  value: string;
}

/** 라벨/값 테이블 (원본·정규화 표시용) */
export function FieldTable({ rows, copyable }: { rows: FieldRow[]; copyable?: boolean }) {
  const shown = rows.filter((r) => (r.value ?? '').trim().length > 0);
  if (shown.length === 0) {
    return <p className="px-1 py-2 text-xs text-slate-400">데이터 없음</p>;
  }
  return (
    <dl className="divide-y divide-slate-100 dark:divide-slate-800">
      {shown.map((r) => (
        <div key={r.label} className="flex items-start gap-3 py-1.5">
          <dt className="w-24 shrink-0 text-xs text-slate-400">{r.label}</dt>
          <dd className="flex-1 break-words text-sm text-slate-800 dark:text-slate-100">{r.value}</dd>
          {copyable && <CopyButton text={r.value} label="" />}
        </div>
      ))}
    </dl>
  );
}
