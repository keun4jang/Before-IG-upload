import type { SheetType } from '../schemas';

/** 통합본(Weekly Production 탭) 예시 데이터 — 실제 시트와 같은 열 구성(가상의 값) */
export const masterSample: {
  sheetType: SheetType;
  url: string;
  headers: string[];
  rows: string[][];
} = {
  sheetType: 'master',
  url: 'https://docs.google.com/spreadsheets/d/1iKClmdYBLd6Q1Bhiy40wjiCBsBPO4QmgGniCby13wVY/edit?gid=100#gid=100',
  headers: [
    'Thumbnail', 'Date', 'Weekday', 'Time', 'Duration', 'Program', 'Language', 'Host',
    'Instagram', 'City', 'Meet Point', 'Price', 'Address', 'Course', 'Distance',
    'Additional Info', 'Validation', 'Sort Date',
  ],
  rows: [
    ['', '7월 1일 수요일', '수', 'AM 8:00', 'AM 8:00 - AM 9:00', '데일리 커피 챗', '한국어', '호스트A', '@host_a', '강남구', '샘플커피 역삼점', '1인 1잔', '서울 강남구 테헤란로 1', '', '', '', 'OK', ''],
    ['', '7월 3일 금요일', '금', 'AM 7:00', 'AM 7:00 - AM 9:00', '에스프레소 런', '한국어', '호스트B', '@host_b', '성수', '샘플로스터스 성수', '15,000원', '서울 성동구 성수이로 1', '샘플로스터스 → 서울숲 → 샘플로스터스', '5km', '짐보관 가능', 'OK', ''],
    ['', 'Jul 1st Wed', '수', 'AM 8:00', 'AM 8:00 - AM 9:00', 'Coffee Chat', 'English', 'HostC', '@host_c', 'Yeongdeungpo-gu (영등포구)', 'SAMPLE COFFEE', 'Min. 1 Drink', 'Gukjegeumyung-ro 1', '', '', '', 'OK', ''],
    ['', '7월 4일 토요일', '토', 'AM 8:00', 'AM 8:00 - AM 10:00', '북 다이브', '한국어', '호스트D', '@host_d', '멜버른', 'Sample Books & Coffee', '$25', '1 Sample St, Melbourne VIC 3000', '', '', '자유롭게 읽고 싶은 책 1권', 'OK', ''],
  ],
};
