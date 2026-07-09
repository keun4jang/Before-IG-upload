import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <span className="text-slate-900">
            Before<span className="text-brand-600"> IG</span> Upload
          </span>
        </Link>
      </div>
    </header>
  );
}
