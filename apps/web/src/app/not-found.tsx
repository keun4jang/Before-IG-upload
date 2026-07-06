import Link from 'next/link';
import { Button } from '@big/ui';

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-6xl font-extrabold text-brand-600">404</p>
      <h1 className="mt-4 text-xl font-bold">페이지를 찾을 수 없어요</h1>
      <p className="mt-2 text-sm text-slate-500">
        주소가 바뀌었거나 삭제된 프로젝트일 수 있어요.
      </p>
      <div className="mt-6 flex gap-2">
        <Link href="/">
          <Button variant="outline">홈으로</Button>
        </Link>
        <Link href="/dashboard">
          <Button>대시보드</Button>
        </Link>
      </div>
    </div>
  );
}
