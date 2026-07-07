import { baseNormalize, type NormalizeMeta, type ColumnKeywords } from './base';
import type { NormalizedEvent } from '../schemas';

const COLUMNS: ColumnKeywords = {
  date: ['preferred date', '일정', 'date'],
  time: ['preferred time', '시간', 'time'],
  region: ['district', 'area', '지역'],
  cafeName: ['cafe name', '카페 이름', '카페이름'],
  cafeNameExclude: ['address', '주소', 'branch', '지점'],
  cafeAddress: ['street address', '도로명', '주소', 'address'],
  branch: ['branch', '지점'],
  host: ['instagram', '인스타그램', 'host'],
};

export function normalizeDailyCoffeeChatEn(
  headers: string[],
  row: string[],
  meta: NormalizeMeta,
): NormalizedEvent {
  return baseNormalize(headers, row, COLUMNS, meta);
}
