import { ShieldAlert } from 'lucide-react';
import { SAFETY_NOTICE } from '@big/shared';
import { cn } from '@big/ui';

export function SafetyNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200',
        className,
      )}
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{SAFETY_NOTICE}</p>
    </div>
  );
}
