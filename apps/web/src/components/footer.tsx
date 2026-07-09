'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface VersionInfo {
  version: string;
  commit: string;
  buildDate: string;
}

export function Footer() {
  // 빌드 시점 값으로 우선 표시하고, 마운트 후 캐시를 우회해 실서버 값으로 재확인한다.
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
      <div className="container-page flex items-center justify-between gap-3 py-4 text-xs text-slate-400">
        <span>검토 결과는 참고용입니다.</span>
        <div className="flex items-center gap-3">
          <Link href="/smcc" className="hover:text-brand-600">
            SMCC
          </Link>
          <span className="font-mono text-[11px]" title={`build ${info.buildDate}`}>
            v{info.version}
            {info.buildDate ? ` · ${info.buildDate}` : ''}
            {info.commit ? ` · ${info.commit}` : ''}
          </span>
        </div>
      </div>
    </footer>
  );
}
