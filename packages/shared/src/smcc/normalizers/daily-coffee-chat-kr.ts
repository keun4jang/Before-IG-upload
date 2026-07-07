import { baseNormalize, type NormalizeMeta, type ColumnKeywords } from './base';
import type { NormalizedEvent } from '../schemas';

const COLUMNS: ColumnKeywords = {
  date: ['날짜', 'date'],
  time: ['시간', 'time'],
  region: ['지역', 'area'],
  cafeName: ['카페명', '카페 이름', '카페이름'],
  cafeNameExclude: ['주소', 'address', '지점'],
  cafeAddress: ['주소', 'address'],
  branch: ['지점명', 'branch'],
  host: ['호스트 아이디', '호스트아이디', '인스타그램', 'instagram'],
};

export function normalizeDailyCoffeeChatKr(
  headers: string[],
  row: string[],
  meta: NormalizeMeta,
): NormalizedEvent {
  return baseNormalize(headers, row, COLUMNS, meta);
}
