'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@big/ui';

export function CopyButton({ text, label = '복사', className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {
          /* ignore */
        }
      }}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-smcc-600 dark:hover:bg-slate-800',
        className,
      )}
    >
      {done ? <Check className="h-3 w-3 text-smcc-600" /> : <Copy className="h-3 w-3" />}
      {done ? '완료' : label}
    </button>
  );
}
