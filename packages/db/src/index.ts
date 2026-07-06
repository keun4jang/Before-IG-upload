/**
 * Prisma 클라이언트 래퍼.
 * @prisma/client 가 generate 되지 않았거나 DATABASE_URL 이 없어도
 * import 자체는 실패하지 않도록 lazy 로딩합니다. (DEMO 모드 안전)
 */
export type PrismaClientLike = any;

let client: PrismaClientLike | null = null;

export async function getPrisma(): Promise<PrismaClientLike> {
  if (client) return client;
  const mod = await import('@prisma/client');
  const PrismaClient = (mod as any).PrismaClient;
  const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClientLike };
  client = globalForPrisma.__prisma ?? new PrismaClient();
  if (process.env.NODE_ENV !== 'production') globalForPrisma.__prisma = client;
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}
