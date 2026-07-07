'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SAFETY_NOTICE } from '@big/shared';

interface VersionInfo {
  version: string;
  commit: string;
  buildDate: string;
}

export function Footer() {
  // 빌드 시점 값으로 우선 표시하고, 마운트 후 캐시를 우회해 실서버 값으로 재확인한다.
  // (CDN/정적 캐시가 오래된 HTML을 서빙하더라도 여기서 실제 값으로 즉시 교정됨)
  const [info, setInfo] = useState<VersionInfo>({
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0',
    commit: process.env.NEXT_PUBLIC_APP_COMMIT ?? '',
    buildDate: process.env.NEXT_PUBLIC_BUILD_DATE ?? '',
  });

  useEffect(() => {
    fetch(`/api/version?_=${Date.now()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: VersionInfo) => setInfo(data))
      .catch(() => {});
  }, []);

  return (
    <footer className="border-t border-slate-200/70 bg-white dark:border-slate-800/70 dark:bg-slate-950">
      <div className="container-page flex flex-col gap-3 py-8 text-sm text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-slate-700 dark:text-slate-300">Before IG Upload</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            이 웹사이트는 <span className="font-medium text-slate-700 dark:text-slate-300">근감독</span>이 만들었습니다.
          </p>
          <p className="mt-1 max-w-xl text-xs leading-relaxed">{SAFETY_NOTICE}</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <Link href="/smcc" className="hover:text-brand-600">
            SMCC
          </Link>
          <Link href="/dashboard" className="hover:text-brand-600">
            대시보드
          </Link>
          <a
            href="https://github.com/keun4jang/before-ig-upload"
            target="_blank"
            rel="noreferrer"
            className="hover:text-brand-600"
          >
            GitHub
          </a>
          <span className="font-mono text-[11px] text-slate-400" title={`build ${info.buildDate}`}>
            v{info.version}
            {info.commit ? ` · ${info.commit}` : ''}
          </span>
        </div>
      </div>
    </footer>
  );
}
