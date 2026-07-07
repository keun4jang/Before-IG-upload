import { CONDITION_LABEL } from '../constants';
import { PROGRAM_CONFIG } from '../program-config';
import type { FeeMode, LanguageMode, ProgramType } from '../schemas';
import { krw, usd } from './money';

export interface FeeResolution {
  feeMode: FeeMode;
  feeLabelExpected: string;
  conditionLabelExpected: string;
}

/**
 * SMCC 참가비/참가조건 규칙.
 * - Espresso Run: 유료. KR 카페1곳 15,000원 / 2곳+ 20,000원, EN $30
 * - Book Dive: EN(멜버른) $25, KR 무료(1인 1잔)
 * - 그 외: 무료(1인 1잔 / Min. 1 Drink)
 */
export function resolveFee(
  programType: ProgramType,
  language: LanguageMode,
  cafeCount: number,
): FeeResolution {
  const free = (): FeeResolution => ({
    feeMode: 'free',
    feeLabelExpected: CONDITION_LABEL[language],
    conditionLabelExpected: CONDITION_LABEL[language],
  });

  if (programType === 'espresso-run') {
    if (language === 'EN') {
      return { feeMode: 'paid', feeLabelExpected: usd(30), conditionLabelExpected: '' };
    }
    const amount = cafeCount >= 2 ? 20000 : 15000;
    return { feeMode: 'paid', feeLabelExpected: krw(amount), conditionLabelExpected: '' };
  }

  if (programType === 'book-dive' && language === 'EN') {
    return { feeMode: 'paid', feeLabelExpected: usd(25), conditionLabelExpected: '' };
  }

  return free();
}

/** 프로그램명 라벨 (언어별) */
export function programName(programType: ProgramType, language: LanguageMode): string {
  const c = PROGRAM_CONFIG[programType];
  return language === 'EN' ? c.nameEn : c.nameKr;
}
