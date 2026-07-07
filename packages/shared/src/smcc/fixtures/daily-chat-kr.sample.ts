import type { SheetType } from '../schemas';

export const dailyChatKrSample: {
  sheetType: SheetType;
  url: string;
  headers: string[];
  rows: string[][];
} = {
  sheetType: 'daily-coffee-chat-kr',
  url: 'https://docs.google.com/spreadsheets/d/1jj6vIWF1nu0zwF_kJowGpUdqG_DknEjPfEEHPh8SwMU/edit',
  headers: ['접수시각', '날짜', '시간', '지역', '카페명', '주소', '호스트 아이디', '지점명', '색상'],
  rows: [
    [
      'Mon Jul 06 2026 09:37:35 GMT+0900',
      '7월 8일 수요일',
      'AM 7:30',
      '강남구',
      '알렉산더커피스튜디오',
      '서울 강남구 테헤란로51길 23 1층',
      '@just_do_lawyer',
      '선릉역',
      '#FA6D57',
    ],
    // 요일이 일부러 틀린 예시 (날짜/요일 불일치 데모)
    [
      'Sun Jul 05 2026 22:40:30 GMT+0900',
      '7월 8일 금요일',
      'AM 7:30',
      '영등포구',
      'WAYP',
      '서울 영등포구 당산로33길 21',
      '@jaeuk_j',
      '',
      '#726DF3',
    ],
  ],
};
