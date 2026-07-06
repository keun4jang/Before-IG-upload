'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, UploadCloud } from 'lucide-react';
import { cn } from '@big/ui';

export interface PreparedImage {
  fileName: string;
  mimeType: string;
  previewUrl: string;
  width?: number;
  height?: number;
  sizeBytes: number;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

async function fileToPrepared(file: File): Promise<PreparedImage> {
  const previewUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const dims = await new Promise<{ w: number; h: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = previewUrl;
  });
  return {
    fileName: file.name,
    mimeType: file.type,
    previewUrl,
    width: dims.w || undefined,
    height: dims.h || undefined,
    sizeBytes: file.size,
  };
}

export function Uploader({
  onAdd,
  disabled,
  remaining,
}: {
  onAdd: (images: PreparedImage[]) => Promise<void>;
  disabled?: boolean;
  remaining: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const files = Array.from(fileList).filter((f) => ACCEPTED.includes(f.type));
    if (files.length === 0) {
      setError('JPG, PNG, WebP 이미지만 올릴 수 있어요.');
      return;
    }
    const limited = files.slice(0, Math.max(0, remaining));
    if (limited.length < files.length) {
      setError(`한 프로젝트당 최대 20장까지 올릴 수 있어요.`);
    }
    if (limited.length === 0) return;
    setBusy(true);
    try {
      const prepared = await Promise.all(limited.map(fileToPrepared));
      await onAdd(prepared);
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드에 실패했어요.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled) void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition',
          dragOver
            ? 'border-brand-400 bg-brand-50/60 dark:bg-brand-950/30'
            : 'border-slate-300 hover:border-brand-300 dark:border-slate-700',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        {busy ? (
          <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
        ) : (
          <UploadCloud className="h-7 w-7 text-slate-400" />
        )}
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          이미지를 끌어다 놓거나 클릭해 업로드
        </p>
        <p className="flex items-center gap-1 text-xs text-slate-400">
          <ImagePlus className="h-3.5 w-3.5" /> JPG · PNG · WebP · 최대 {remaining}장 더 가능
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          multiple
          hidden
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
