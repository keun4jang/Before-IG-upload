import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * SMCC 검수 제출 로그 중앙 수집.
 * BLOB_READ_WRITE_TOKEN 이 설정돼 있으면 Vercel Blob 에 저장(운영자가 열람 가능),
 * 없으면 안전하게 no-op 응답(클라이언트는 이미 로컬에 저장함).
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: true, stored: 'client-only' });
  }

  try {
    const { put } = await import('@vercel/blob');
    const entry = body as { id?: string; sheetType?: string; rowIndex?: number };
    const key = `smcc-logs/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${entry.id ?? 'x'}.json`;
    const { url } = await put(key, JSON.stringify(body), {
      access: 'public',
      contentType: 'application/json',
      token,
      addRandomSuffix: false,
    });
    return NextResponse.json({ ok: true, stored: 'blob', url });
  } catch (err) {
    return NextResponse.json(
      { ok: false, stored: 'client-only', error: err instanceof Error ? err.message : 'blob error' },
      { status: 200 },
    );
  }
}
