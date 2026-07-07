'use client';

import { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

/** 카드 이미지(선택) + 카드 텍스트 입력. 이미지에서 텍스트 자동 추출(OCR) 지원. */
export function CardReviewer({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [ocr, setOcr] = useState<{ running: boolean; progress: number; error?: string }>({
    running: false,
    progress: 0,
  });

  function onFile(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function runOcr() {
    if (!preview) return;
    setOcr({ running: true, progress: 0 });
    try {
      const Tesseract = (await import('tesseract.js')).default;
      const { data } = await Tesseract.recognize(preview, 'kor+eng', {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            setOcr((s) => ({ ...s, progress: Math.round(m.progress * 100) }));
          }
        },
      });
      const text = (data.text ?? '').trim();
      onChange(text || value);
      setOcr({ running: false, progress: 100 });
    } catch {
      setOcr({ running: false, progress: 0, error: '자동 추출 실패 — 직접 입력하세요.' });
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">카드</span>
        <div className="flex items-center gap-1">
          {preview && (
            <button
              onClick={runOcr}
              disabled={ocr.running}
              className="inline-flex items-center gap-1 rounded-md bg-smcc-500 px-2 py-0.5 text-xs font-medium text-white hover:bg-smcc-600 disabled:opacity-50"
            >
              {ocr.running && <Loader2 className="h-3 w-3 animate-spin" />}
              {ocr.running ? `추출 ${ocr.progress}%` : '이미지에서 추출'}
            </button>
          )}
          <button
            onClick={() => inputRef.current?.click()}
            className="rounded-md px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            이미지
          </button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      {preview && (
        <img src={preview} alt="card" className="max-h-40 rounded-md border border-slate-200 dark:border-slate-800" />
      )}
      {ocr.error && <p className="text-xs text-rose-500">{ocr.error}</p>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="카드 텍스트 입력 / 붙여넣기 (또는 이미지에서 추출)"
        className="min-h-[140px] w-full resize-y rounded-md border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-smcc-400 focus:ring-2 focus:ring-smcc-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-smcc-900"
      />
    </div>
  );
}
