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
    return { table: { headers: fx.headers, rows: fx.rows }, source: 'fixture', message: '네트워크 오류 — 예시 데이터 사용' };
  }
}

export interface PlaceApiResult {
  candidates: smcc.PlaceCandidate[];
  degraded: boolean;
}

export async function verifyPlace(query: string): Promise<PlaceApiResult> {
  try {
    const res = await fetch(`/api/smcc/place?q=${encodeURIComponent(query)}`);
    if (!res.ok) return { candidates: [], degraded: true };
    return (await res.json()) as PlaceApiResult;
  } catch {
    return { candidates: [], degraded: true };
  }
}

// --- 로컬 저장(작업 이어하기) ---
const KEY = (sheetType: string, rowIndex: number) => `smcc:${sheetType}:${rowIndex}`;

export interface SavedWork {
  cardText: string;
  resolved: string[]; // 처리한 이슈 id
  memo: string;
  updatedAt: string;
}

export function loadWork(sheetType: string, rowIndex: number): SavedWork | null {
  try {
    const raw = localStorage.getItem(KEY(sheetType, rowIndex));
    return raw ? (JSON.parse(raw) as SavedWork) : null;
  } catch {
    return null;
  }
}

export function saveWork(sheetType: string, rowIndex: number, work: SavedWork): void {
  try {
    localStorage.setItem(KEY(sheetType, rowIndex), JSON.stringify(work));
  } catch {
    /* ignore */
  }
}

export function mapSearchUrl(q: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
export function webSearchUrl(q: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}
