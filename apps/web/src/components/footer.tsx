import Link from 'next/link';
import { SAFETY_NOTICE } from '@big/shared';

export function Footer() {
  return (
    <footer className="border-t border-slate-200/70 bg-white dark:border-slate-800/70 dark:bg-slate-950">
      <div className="container-page flex flex-col gap-3 py-8 text-sm text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-slate-700 dark:text-slate-300">Before IG Upload</p>
          <p className="mt-1 max-w-xl text-xs leading-relaxed">{SAFETY_NOTICE}</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <Link href="/dashboard" className="hover:text-brand-600">
            대시보드
          </Link>
          <Link href="/settings" className="hover:text-brand-600">
            설정
          </Link>
          <a
            href="https://github.com/keun4jang/before-ig-upload"
            target="_blank"
            rel="noreferrer"
            className="hover:text-brand-600"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
