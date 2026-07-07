import type { SheetType } from '../schemas';

export const dailyChatEnSample: {
  sheetType: SheetType;
  url: string;
  headers: string[];
  rows: string[][];
} = {
  sheetType: 'daily-coffee-chat-en',
  url: 'https://docs.google.com/spreadsheets/d/10CPnc5Kcy1biFiN6ZU2IPhx-LRWUVDK6jqwxlrs8JWg/edit',
  headers: [
    '타임스탬프',
    '진행 희망 일정 (Preferred Date)',
    '진행 희망 시간 (Preferred Time)',
    '진행 희망 지역 (Preferred District/Area)',
    '카페 이름 (Cafe Name)',
    '카페 지점명 (Cafe Branch - Optional)',
    '카페 도로명 주소 (Cafe Street Address)',
    '인스타그램 아이디 (Instagram ID)',
  ],
  rows: [
    [
      '2026. 7. 6',
      'Jul 10',
      'AM 7:30',
      'Seongsu',
      'Center Coffee',
      '',
      '66 Seongsui-ro, Seongdong-gu',
      '@daily_en_host',
    ],
  ],
};
