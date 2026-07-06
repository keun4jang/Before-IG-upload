/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 워크스페이스 패키지를 소스(TS)로 직접 트랜스파일
  transpilePackages: ['@big/shared', '@big/ui', '@big/db'],
  eslint: {
    // 루트에서 통합 eslint 실행하므로 build 중 lint 생략
    ignoreDuringBuilds: true,
  },
  experimental: {
    // 서버 액션 body 크기 (이미지 data URL 업로드 대비)
    serverActions: { bodySizeLimit: '15mb' },
    // 서버 전용 패키지는 번들링에서 제외 (동적 import)
    serverComponentsExternalPackages: ['@prisma/client', 'tesseract.js'],
  },
  output: 'standalone',
};

export default nextConfig;
