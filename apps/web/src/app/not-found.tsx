import Link from 'next/link';
import { Button } from '@big/ui';

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-6xl font-extrabold text-brand-600">404</p>
      <Link href="/" className="mt-6">
        <Button>처음으로</Button>
      </Link>
    </div>
  );
}
