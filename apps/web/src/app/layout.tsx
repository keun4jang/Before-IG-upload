import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';

// 정적 캐시로 인해 새 배포가 늦게 반영되는 문제를 막기 위해 전체 앱을 매 요청마다
// 새로 렌더링한다(운영툴 특성상 실시간 반영이 캐시 최적화보다 중요).
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: {
    default: 'Before IG Upload — 인스타 업로드 전, 마지막 검수',
    template: '%s · Before IG Upload',
  },
  description:
    '카드뉴스·캐러셀·캡션을 인스타그램에 올리기 전에 오타, 중복 표현, 근거 기반 사실 검토까지 한 번에 점검하세요.',
  keywords: ['인스타그램', '카드뉴스', '검수', '오타 검사', '맞춤법', '사실 확인', '캡션'],
  openGraph: {
    title: 'Before IG Upload',
    description: '올리기 전에 한 번 더 확인하세요. 오타·중복·사실 검토까지.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
};

// 다크모드 FOUC 방지 스크립트
const themeScript = `
(function(){try{
  var t = localStorage.getItem('theme');
  var d = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', d);
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
