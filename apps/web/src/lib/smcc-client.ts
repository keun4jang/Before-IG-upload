'use client';

import { smcc } from '@big/shared';

export type SheetTable = { headers: string[]; rows: string[][] };
export interface SheetTab {
  title: string;
  headers: string[];
  rows: string[][];
}

/** 공개 시트 로드(탭별로 분리). 실패 시 fixture 로 fallback. */
export async function loadSheet(
  sheetType: smcc.SheetType,
  url: string,
): Promise<{ tabs: SheetTab[]; source: 'live' | 'fixture'; message?: string }> {
  try {
    const res = await fetch(`/api/smcc/sheet?url=${encodeURIComponent(url)}`);
    if (res.ok) {
      const data = (await res.json()) as { tabs: SheetTab[] };
      const totalRows = data.tabs.reduce((n, t) => n + t.rows.length, 0);
      if (totalRows > 0) {
        return {
          tabs: data.tabs,
          source: 'live',
          message: data.tabs.length > 1 ? `${data.tabs.length}개 탭 통합` : undefined,
        };
      }
    }
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    const fx = smcc.FIXTURES[sheetType];
    return {
      tabs: [{ title: '', headers: fx.headers, rows: fx.rows }],
      source: 'fixture',
      message: err.error ?? '실시간 로드 실패 — 예시 데이터 사용',
    };
  } catch {
    const fx = smcc.FIXTURES[sheetType];
    return {
      tabs: [{ title: '', headers: fx.headers, rows: fx.rows }],
      source: 'fixture',
      message: '네트워크 오류 — 예시 데이터 사용',
    };
  }
}
