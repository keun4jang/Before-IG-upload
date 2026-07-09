'use client';

import { smcc } from '@big/shared';

export type SheetTable = { headers: string[]; rows: string[][] };

/** 공개 시트 로드. 실패 시 fixture 로 fallback. */
export async function loadSheet(
  sheetType: smcc.SheetType,
  url: string,
): Promise<{ table: SheetTable; source: 'live' | 'fixture'; message?: string }> {
  try {
    const res = await fetch(`/api/smcc/sheet?url=${encodeURIComponent(url)}`);
    if (res.ok) {
      const data = (await res.json()) as SheetTable;
      if (data.rows.length > 0) return { table: data, source: 'live' };
    }
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    const fx = smcc.FIXTURES[sheetType];
    return {
      table: { headers: fx.headers, rows: fx.rows },
      source: 'fixture',
      message: err.error ?? '실시간 로드 실패 — 예시 데이터 사용',
    };
  } catch {
    const fx = smcc.FIXTURES[sheetType];
    return {
      table: { headers: fx.headers, rows: fx.rows },
      source: 'fixture',
      message: '네트워크 오류 — 예시 데이터 사용',
    };
  }
}
