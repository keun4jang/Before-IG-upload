'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@big/ui';
import { api } from '@/lib/api-client';
import { getLocalProjectDetail } from '@/lib/local-projects';
import { Workspace } from '@/components/workspace';
import type { ProjectDetail } from '@/lib/store/types';

type LoadState = 'loading' | 'ready' | 'notfound';

export default function ProjectPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [state, setState] = useState<LoadState>('loading');
  const [detail, setDetail] = useState<ProjectDetail | null>(null);

  useEffect(() => {
    let alive = true;
    setState('loading');

    // 1순위: 브라우저에 저장된 프로젝트 (서버리스에서도 항상 신뢰 가능)
    const local = getLocalProjectDetail(id);
    if (local) {
      if (alive) {
        setDetail(local);
        setState('ready');
        document.title = `${local.project.name} · Before IG Upload`;
      }
      return () => {
        alive = false;
      };
    }

    // 2순위: 서버(데모 프로젝트 등 항상 시드되는 항목)
    api
      .getProject(id)
      .then((remote) => {
        if (!alive) return;
        setDetail(remote);
        setState('ready');
        document.title = `${remote.project.name} · Before IG Upload`;
      })
      .catch(() => {
        if (alive) setState('notfound');
      });

    return () => {
      alive = false;
    };
  }, [id]);

  if (state === 'loading') {
    return (
      <div className="container-page py-16 text-center text-sm text-slate-400">불러오는 중…</div>
    );
  }

  if (state === 'notfound' || !detail) {
    return (
      <div className="container-page flex min-h-[50vh] flex-col items-center justify-center text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <h1 className="mt-4 text-xl font-bold">프로젝트를 찾을 수 없어요</h1>
        <p className="mt-2 text-sm text-slate-500">
          이 브라우저에 저장된 프로젝트가 아니거나 삭제되었을 수 있어요.
        </p>
        <Link href="/dashboard" className="mt-6">
          <Button>대시보드로</Button>
        </Link>
      </div>
    );
  }

  return <Workspace initial={detail} />;
}
