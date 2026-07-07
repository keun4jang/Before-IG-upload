import { baseNormalize, type NormalizeMeta, type ColumnKeywords } from './base';
import type { NormalizedEvent } from '../schemas';

const COLUMNS: ColumnKeywords = {
  date: ['행사일시', '일시', 'date'],
  time: ['행사시각', '시각', 'time'],
  region: ['지역', 'area'],
  cafeName: ['카페이름', '카페 이름', 'cafe name'],
  cafeNameExclude: ['주소', 'address', '지점'],
  cafeAddress: ['카페주소', '카페 주소', '도로명', 'address'],
  branch: ['지점명', 'branch'],
  host: ['호스트아이디', '호스트 아이디', '인스타그램', 'instagram'],
  language: ['언어', 'language'],
  notes: ['의견', 'comments', 'feedback'],
};

export function normalizeBookDive(
  headers: string[],
  row: string[],
  meta: NormalizeMeta,
): NormalizedEvent {
  return baseNormalize(headers, row, COLUMNS, meta);
}
