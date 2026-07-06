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
      <h1 className="mt-4 text-xl font-bold">문제가 발생했어요</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        일시적인 오류일 수 있어요. 다시 시도해보세요. 계속되면 새로고침해 주세요.
      </p>
      <p className="mt-2 text-xs text-slate-400">{error.message}</p>
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>다시 시도</Button>
        <Button variant="outline" onClick={() => (window.location.href = '/dashboard')}>
          대시보드로
        </Button>
      </div>
    </div>
  );
}
