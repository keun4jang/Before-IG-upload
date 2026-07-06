/**
 * 저장소 팩토리.
 * - DEMO_MODE(기본) 또는 DATABASE_URL 미설정 → in-memory 저장소
 * - 프로덕션(PostgreSQL) → Prisma 기반 저장소는 `./prisma` 로 확장 (packages/db 스키마 제공).
 *
 * 두 구현 모두 동일한 `Store` 인터페이스를 만족하므로 나머지 코드는 변경할 필요가 없습니다.
 */
import { env } from '../env';
import { memoryStore } from './memory';
import type { Store } from './types';

let cached: Store | null = null;

export function getStore(): Store {
  if (cached) return cached;
  if (env.demoMode) {
    cached = memoryStore;
  } else {
    // 프로덕션 Prisma 저장소 연결 지점.
    // packages/db 의 스키마/클라이언트를 사용하는 PrismaStore 를 여기에 주입하세요.
    // 아직 미구현이면 안전하게 in-memory 로 degrade 합니다.
    console.warn(
      '[store] DEMO_MODE=0 이지만 Prisma 저장소가 연결되지 않아 in-memory 로 동작합니다. ' +
        'apps/web/src/lib/store/prisma.ts 를 구현해 주입하세요.',
    );
    cached = memoryStore;
  }
  return cached;
}

export type { Store, ProjectDetail } from './types';
