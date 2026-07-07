// 캐시 절대 금지 — 이 엔드포인트는 "지금 실제로 떠 있는 서버"의 버전을 확인하는 용도.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export function GET() {
  return new Response(
    JSON.stringify({
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0',
      commit: process.env.NEXT_PUBLIC_APP_COMMIT ?? '',
      buildDate: process.env.NEXT_PUBLIC_BUILD_DATE ?? '',
      serverTime: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    },
  );
}
