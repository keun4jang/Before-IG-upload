import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@big/ui';
import { ThemeToggle } from './theme-toggle';

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-950/70">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <span className="text-slate-900 dark:text-slate-100">
            Before<span className="text-brand-600"> IG</span> Upload
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/smcc">
            <Button variant="ghost" size="sm">
              SMCC
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              대시보드
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="ghost" size="sm">
              설정
            </Button>
          </Link>
          <ThemeToggle />
          <Link href="/projects/new" className="hidden sm:block">
            <Button size="sm">새 프로젝트</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
