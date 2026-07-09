'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@big/ui';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <AlertTriangle className="h-10 w-10 text-amber-500" />
      <p className="mt-2 text-xs text-slate-400">{error.message}</p>
      <Button className="mt-6" onClick={reset}>
        다시 시도
      </Button>
    </div>
  );
}
