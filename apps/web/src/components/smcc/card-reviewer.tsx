'use client';

import { useRef, useState } from 'react';

/** 카드 이미지(선택) + 카드 텍스트 입력 */
export function CardReviewer({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function onFile(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">카드</span>
        <button
          onClick={() => inputRef.current?.click()}
          className="rounded-md px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          이미지
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>
      {preview && (
        <img src={preview} alt="card" className="max-h-40 rounded-md border border-slate-200 dark:border-slate-800" />
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="카드 텍스트 입력 / 붙여넣기"
        className="min-h-[140px] w-full resize-y rounded-md border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-smcc-400 focus:ring-2 focus:ring-smcc-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-smcc-900"
      />
    </div>
  );
}
