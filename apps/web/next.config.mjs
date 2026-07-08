import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// 버전 = 빌드 횟수(v1부터) + 날짜 + 커밋 해시.
// 빌드 횟수는 커밋에 포함되는 build-number.json 에서 읽는다.
// (Vercel 은 얕은 clone 이라 git 커밋 개수 세기가 불가능하므로, 파일로 관리.)
function git(cmd, fallback) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return fallback;
  }
}
function buildNo() {
  try {
    return JSON.parse(readFileSync(new URL('./build-number.json', import.meta.url), 'utf8')).build;
  } catch {
    return 0;
  }
}
// Vercel 이 주입하는 값을 최우선으로 사용(가장 신뢰 가능), 로컬 개발 시에만 git 명령으로 보완.
const commitSha = (process.env.VERCEL_GIT_COMMIT_SHA ?? git('git rev-parse HEAD', 'dev')).slice(0, 7);
const buildDate = new Date().toISOString().slice(0, 10);
const appVersion = String(buildNo());

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
