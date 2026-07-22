import type { ProgramType, SheetType } from './schemas';

export interface ProgramConfig {
  type: ProgramType;
  nameKr: string;
  nameEn: string;
  durationMin: number;
  /** 기본 유료 여부 (지역/언어에 따라 세부 규칙은 fee validator 에서) */
  paidByDefault: boolean;
  requiresRoute: boolean;
  requiresDistance: boolean;
  /** 언어 자유 허용(Rave) */
  allowAnyLanguage: boolean;
  /** 카드에 반드시 노출할 추가 정보 */
  additionalInfo: string[];
}

export const PROGRAM_CONFIG: Record<ProgramType, ProgramConfig> = {
  'espresso-run': {
    type: 'espresso-run',
    nameKr: '에스프레소 런',
    nameEn: 'Espresso Run',
    durationMin: 120,
    paidByDefault: true,
    requiresRoute: true,
    requiresDistance: true,
    allowAnyLanguage: false,
    additionalInfo: ['거리 표기 필수', '코스 표기 필수'],
  },
  'book-dive': {
    type: 'book-dive',
    nameKr: '북 다이브',
    nameEn: 'Book Dive',
    durationMin: 120,
    paidByDefault: false,
    requiresRoute: false,
    requiresDistance: false,
    allowAnyLanguage: false,
    additionalInfo: ['Needs 노출', '자유롭게 읽고 싶은 책 1권', '전자책, 종이책 모두 가능합니다.'],
  },
  'daily-coffee-chat': {
    type: 'daily-coffee-chat',
    nameKr: '데일리 커피 챗',
    nameEn: 'Daily Coffee Chat',
    durationMin: 60,
    paidByDefault: false,
    requiresRoute: false,
    requiresDistance: false,
    allowAnyLanguage: false,
    additionalInfo: [],
  },
  rave: {
    type: 'rave',
    nameKr: '레이브',
    nameEn: 'Rave',
    durationMin: 180,
    paidByDefault: false,
    requiresRoute: false,
    requiresDistance: false,
    allowAnyLanguage: true,
    additionalInfo: [],
  },
  'glow-up': {
    type: 'glow-up',
    nameKr: '글로우 업',
    nameEn: 'Glow Up',
    durationMin: 90,
    paidByDefault: false,
    requiresRoute: false,
    requiresDistance: false,
    allowAnyLanguage: false,
    additionalInfo: [],
  },
};

export const SHEET_TO_PROGRAM: Record<SheetType, ProgramType> = {
  // master(통합본)는 행마다 Program 열이 명시돼 있어 이 기본값은 사용되지 않는다.
  master: 'daily-coffee-chat',
  'espresso-run': 'espresso-run',
  'book-dive': 'book-dive',
  'daily-coffee-chat-kr': 'daily-coffee-chat',
  'daily-coffee-chat-en': 'daily-coffee-chat',
};

export const SHEET_TO_LANGUAGE: Record<SheetType, 'KR' | 'EN'> = {
  // master(통합본)는 행마다 Language 열이 명시돼 있어 이 기본값은 사용되지 않는다.
  master: 'KR',
  'espresso-run': 'KR',
  'book-dive': 'KR',
  'daily-coffee-chat-kr': 'KR',
  'daily-coffee-chat-en': 'EN',
};
