import type { SheetType } from '../schemas';

export const espressoRunSample: {
  sheetType: SheetType;
  url: string;
  headers: string[];
  rows: string[][];
} = {
  sheetType: 'espresso-run',
  url: 'https://docs.google.com/spreadsheets/d/1jP2OvDt5R4PFk2oWZGYTakTnxqJysEUtpyA1uqWugoA/edit',
  headers: [
    '타임스탬프',
    '제작여부',
    '진행 희망 일정 | Date of run',
    '신청 희망 시간 | Meeting Time',
    '진행 희망 지역',
    '집결지',
    '집결지의 상세 주소를 남겨주세요 (도로명주소로 표기)',
    'SMCC를 진행할 카페 이름',
    '카페의 도로명 주소',
    '코스',
    '짐 보관',
    '총 진행 거리를 선택해주세요 | Total distance',
    '예상 페이스를 선택해주세요 | Estimated pace',
    '신청하는 호스트의 인스타그램 아이디',
  ],
  rows: [
    [
      '2026. 7. 1',
      '',
      '2026.07.10 금요일',
      'AM 7:00',
      '성수',
      '성수역 3번 출구',
      '서울 성동구 아차산로 100',
      '메쉬커피',
      '서울 성동구 성수이로 66',
      '메쉬커피 → 센터커피',
      '있음',
      '6km',
      '편안하게',
      '@runner_kim',
    ],
  ],
};
