import type { SheetType } from '../schemas';

export const bookDiveSample: {
  sheetType: SheetType;
  url: string;
  headers: string[];
  rows: string[][];
} = {
  sheetType: 'book-dive',
  url: 'https://docs.google.com/spreadsheets/d/1JYAe2H6reHq0Sp4ynJ_B6E-oYBjh3TntsRCiaL713Jk/edit',
  headers: [
    'announced?',
    '타임스탬프',
    '이메일 주소',
    '행사일시',
    '행사시각',
    '지역',
    '카페이름',
    '지점명',
    '카페주소',
    '호스트아이디',
    '대표 이미지',
    '의견',
    '진행하는 언어를 선택해주세요 Language',
  ],
  rows: [
    [
      '',
      '2026. 6. 29 오후 6:48:50',
      'host@example.com',
      '2026.07.12 일요일',
      'AM 8:00',
      '멜버른',
      'Seven Seeds Coffee Roasters',
      '',
      '114 Berkeley St, Carlton VIC 3053',
      'ehprk',
      '',
      '',
      'English',
    ],
  ],
};
