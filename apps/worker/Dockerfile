# --- Before IG Upload · worker (BullMQ) -------------------------------------
# 모노레포 루트를 build context 로:
#   docker build -f apps/worker/Dockerfile -t big-worker .
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --no-frozen-lockfile

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY packages ./packages
COPY apps/worker ./apps/worker
# Prisma client 생성 (DB 사용 시)
RUN pnpm --filter @big/db generate || echo "prisma generate skipped"
CMD ["pnpm", "--filter", "@big/worker", "start"]
