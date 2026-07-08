'use client';

/**
 * SMCC 검수 제출 로그.
 *
 * 목적: 사용자가 테스트하며 입력한 값(카드 텍스트·이미지·선택 행·정답·검출 이슈)을
 * 모두 저장해, 검수가 놓친 케이스를 나중에 함께 재현/수정하기 위함.
 *
 * 저장 위치:
 *  1) 항상 브라우저(localStorage) — 즉시 동작, 내보내기(JSON) 가능
 *  2) 가능하면 서버(/api/smcc/log → Vercel Blob) 로도 fire-and-forget 전송
 *     (BLOB_READ_WRITE_TOKEN 이 설정되면 중앙 수집 활성화)
 */
import type { smcc } from '@big/shared';

export interface SmccLogEntry {
  id: string;
  ts: string; // ISO
  appCommit: string;
  sheetType: string;
  rowIndex: number | null;
  cafeName: string;
  cardText: string;
  imageDataUrl?: string;
  memo?: string;
  event: smcc.NormalizedEvent;
  canonical: smcc.CanonicalCardFields;
  issues: smcc.SmccIssue[];
}

const KEY = 'smcc:logs';
const MAX_ENTRIES = 40; // 이미지 포함 시 용량 고려

function read(): SmccLogEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SmccLogEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: SmccLogEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // 용량 초과 시 이미지 없는 형태로 재시도
    try {
      localStorage.setItem(KEY, JSON.stringify(entries.map(({ imageDataUrl: _i, ...rest }) => rest)));
    } catch {
      /* 그래도 실패하면 포기 */
    }
  }
}

export function listLogs(): SmccLogEntry[] {
  return read().sort((a, b) => b.ts.localeCompare(a.ts));
}

export function logCount(): number {
  return read().length;
}

export function clearLogs(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

function genId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  return g.crypto?.randomUUID?.().slice(0, 12) ?? Math.random().toString(36).slice(2, 14);
}

/** 현재 검수 상태를 로그로 저장하고, 서버에도 best-effort 전송. */
export function saveSmccLog(input: Omit<SmccLogEntry, 'id' | 'ts' | 'appCommit'>): SmccLogEntry {
  const entry: SmccLogEntry = {
    ...input,
    id: genId(),
    ts: new Date().toISOString(),
    appCommit: process.env.NEXT_PUBLIC_APP_COMMIT ?? '',
  };

  const entries = read();
  entries.push(entry);
  while (entries.length > MAX_ENTRIES) entries.shift();
  write(entries);

  // 중앙 수집(활성화된 경우에만 실제 저장, 아니면 서버가 no-op)
  void fetch('/api/smcc/log', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(entry),
  }).catch(() => {});

  return entry;
}

/** 모든 로그를 JSON 문자열로 내보내기. */
export function exportLogsJson(): string {
  return JSON.stringify(
    { exportedAt: new Date().toISOString(), count: read().length, logs: listLogs() },
    null,
    2,
  );
}

export function downloadLogs(): void {
  const blob = new Blob([exportLogsJson()], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `smcc-logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
