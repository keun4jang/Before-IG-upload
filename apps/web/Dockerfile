# --- Before IG Upload · web (Next.js) ---------------------------------------
# 모노레포 루트를 build context 로 사용하세요:
#   docker build -f apps/web/Dockerfile -t big-web .
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# --- deps: 매니페스트만 복사해 캐시 최적화 ---
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
COPY packages/db/package.json packages/db/
COPY apps/web/package.json apps/web/
RUN pnpm install --no-frozen-lockfile

# --- build ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
RUN pnpm --filter @big/web build

# --- run ---
FROM base AS runner
ENV NODE_ENV=production
ENV DEMO_MODE=1
COPY --from=build /app ./
EXPOSE 3000
CMD ["pnpm", "--filter", "@big/web", "start"]
