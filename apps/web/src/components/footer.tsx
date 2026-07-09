'use client';

import { useEffect, useState } from 'react';

interface VersionInfo {
  version: string;
  commit: string;
  buildDate: string;
}

export function Footer() {
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
    <footer className="border-t border-slate-200/70 bg-white">
      <div className="container-page flex items-center justify-between gap-3 py-4 text-xs text-slate-400">
        <span>검토 결과는 참고용입니다. 이 페이지는 근감독이 제작하였습니다.</span>
        <span className="font-mono text-[11px]" title={`build ${info.buildDate}`}>
          v{info.version}
          {info.buildDate ? ` · ${info.buildDate}` : ''}
          {info.commit ? ` · ${info.commit}` : ''}
        </span>
      </div>
    </footer>
  );
}
