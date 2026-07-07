import { baseNormalize, type NormalizeMeta, type ColumnKeywords } from './base';
import type { NormalizedEvent } from '../schemas';

const COLUMNS: ColumnKeywords = {
  date: ['일정', 'date of run', 'date'],
  time: ['시간', 'meeting time', 'time'],
  region: ['진행 희망 지역', '지역', 'area'],
  meetupName: ['집결지'],
  meetupNameExclude: ['주소', 'address', '상세'],
  meetupAddress: ['집결지의 상세', 'address of the meet up', '상세 주소'],
  cafeName: ['카페 이름', '카페이름', 'coffee chat spot', 'cafe name'],
  cafeNameExclude: ['주소', 'address'],
  cafeAddress: ['카페의 도로명', 'coffee chat spot address', '도로명 주소', '카페주소'],
  course: ['코스', 'course'],
  distance: ['거리', 'distance'],
  pace: ['페이스', 'pace'],
  baggage: ['짐 보관', '짐보관', 'baggage'],
  host: ['인스타그램', 'instagram', '호스트아이디', '호스트 아이디'],
};

export function normalizeEspressoRun(
  headers: string[],
  row: string[],
  meta: NormalizeMeta,
): NormalizedEvent {
  return baseNormalize(headers, row, COLUMNS, meta);
}
