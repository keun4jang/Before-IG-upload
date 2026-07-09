import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';

// 정적 캐시로 인해 새 배포가 늦게 반영되는 문제를 막기 위해 전체 앱을 매 요청마다
// 새로 렌더링한다(운영툴 특성상 실시간 반영이 캐시 최적화보다 중요).
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Before IG Upload',
  description: '캡션과 이미지 속 글자를 올리기 전에 검수합니다.',
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="flex min-h-screen flex-col bg-white text-slate-900">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
