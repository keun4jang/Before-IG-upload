import type { NormalizedEvent, SheetType } from '../schemas';
import type { NormalizeMeta } from '../normalizers/base';
import { normalizeEspressoRun } from '../normalizers/espresso-run';
import { normalizeBookDive } from '../normalizers/book-dive';
import { normalizeDailyCoffeeChatKr } from '../normalizers/daily-coffee-chat-kr';
import { normalizeDailyCoffeeChatEn } from '../normalizers/daily-coffee-chat-en';

const NORMALIZERS = {
  'espresso-run': normalizeEspressoRun,
  'book-dive': normalizeBookDive,
  'daily-coffee-chat-kr': normalizeDailyCoffeeChatKr,
  'daily-coffee-chat-en': normalizeDailyCoffeeChatEn,
} as const;

export function normalizeRow(
  sheetType: SheetType,
  headers: string[],
  row: string[],
  meta: Omit<NormalizeMeta, 'sheetType'>,
): NormalizedEvent {
  return NORMALIZERS[sheetType](headers, row, { ...meta, sheetType });
}

/** 시트 전체(헤더 + 데이터행) → NormalizedEvent[] */
export function normalizeSheet(
  sheetType: SheetType,
  sheetUrl: string,
  headers: string[],
  rows: string[][],
  refDate?: Date,
): NormalizedEvent[] {
  return rows.map((row, i) =>
    normalizeRow(sheetType, headers, row, { sheetUrl, rowIndex: i, refDate }),
  );
}
