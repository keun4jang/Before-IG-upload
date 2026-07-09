'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@big/ui';
import { createLocalProject } from '@/lib/local-projects';

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function start() {
    setLoading(true);
    const detail = createLocalProject({ name: '검수' });
    router.push(`/projects/${detail.project.id}`);
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
        캡션과 이미지 속 글자, 올리기 전에 검수하세요.
      </h1>
      <Button size="lg" className="mt-8" onClick={start} disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        검수 시작하기
      </Button>
    </div>
  );
}
