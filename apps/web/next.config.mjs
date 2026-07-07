import { execSync } from 'node:child_process';

// 빌드 시점의 git 정보로 자동 버전 생성 (커밋마다 자동 변경)
function git(cmd, fallback) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return fallback;
  }
}
const commitCount = git('git rev-list --count HEAD', '0');
const commitSha = git('git rev-parse --short HEAD', (process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7));
const appVersion = `0.1.${commitCount}`;
const buildDate = new Date().toISOString().slice(0, 10);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_APP_COMMIT: commitSha,
    NEXT_PUBLIC_BUILD_DATE: buildDate,
  },
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
