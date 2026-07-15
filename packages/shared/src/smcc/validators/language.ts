import { PROGRAM_CONFIG } from '../program-config';
import type { NormalizedEvent, RawSmccIssue } from '../schemas';

const WORD_KOREAN_EN = /\bkorean\b/i;
const WORD_ENGLISH_EN = /\benglish\b/i;
const WORD_HANGUGEO = /한국어/;

/**
 * [wrong-translation rule] 언어 라벨 리터럴 검사.
 * SMCC 카드에는 "Korean" 이라는 단어가 들어갈 일이 없다 — 한국어 진행이면 "한국어",
 * 영문 진행이면 "English" 로만 표기한다. 잘못된 단어가 하나라도 보이면 오류.
 */
export function validateLanguageLabel(e: NormalizedEvent, cardText: string): RawSmccIssue[] {
  const issues: RawSmccIssue[] = [];
  const config = PROGRAM_CONFIG[e.programType];
  if (config.allowAnyLanguage) return issues; // Rave 등은 언어 표기 자유

  const expected = e.languageLabelExpected;

  if (e.languageMode === 'KR') {
    if (WORD_KOREAN_EN.test(cardText)) {
      issues.push({
        category: 'language-mismatch',
        severity: 'error',
        title: '언어 표기 오류',
        description: '한국어 진행은 "한국어"로 표기해야 합니다. "Korean" 은 잘못된 표기입니다.',
        expected,
        actual: 'Korean',
        confidence: 0.9,
        resolutionHint: '"Korean" → "한국어" 로 수정하세요.',
      });
    }
    if (WORD_ENGLISH_EN.test(cardText)) {
      issues.push({
        category: 'language-mismatch',
        severity: 'error',
        title: '언어 표기 오류',
        description: '한국어 진행 카드에 "English" 표기가 있습니다.',
        expected,
        actual: 'English',
        confidence: 0.85,
      });
    }
  } else {
    if (WORD_HANGUGEO.test(cardText)) {
      issues.push({
        category: 'language-mismatch',
        severity: 'error',
        title: '언어 표기 오류',
        description: '영문 진행 카드에 "한국어" 표기가 있습니다.',
        expected,
        actual: '한국어',
        confidence: 0.9,
        resolutionHint: `"한국어" → "${expected}" 로 수정하세요.`,
      });
    }
    if (WORD_KOREAN_EN.test(cardText)) {
      issues.push({
        category: 'language-mismatch',
        severity: 'error',
        title: '언어 표기 오류',
        description: '영문 진행 카드에 "Korean" 표기가 있습니다.',
        expected,
        actual: 'Korean',
        confidence: 0.85,
      });
    }
  }
  return issues;
}

/**
 * 카드 UI 라벨(Date, Meet at 등)은 SMCC 템플릿이 카드 언어와 무관하게 항상 영어로 고정
 * 표기하므로, "라벨 언어가 카드와 다르다"는 검사는 오탐만 많아서(예: "Time After Time" 카페명이
 * "Time" 라벨로 오인) 하지 않는다. 하위호환을 위해 빈 배열을 반환한다.
 */
export function validateCardLabels(_e: NormalizedEvent, _cardText: string): RawSmccIssue[] {
  return [];
}

/**
 * [언어 일관성] 카드에 선언된 진행 언어(언어 아이콘 값)에 맞춰 프로그램명·참가조건이
 * 그 언어로 표기됐는지 검사한다. SMCC 규칙: 언어가 English면 프로그램명/참가조건도 영어,
 * 한국어면 한글. 그 외 잡다한 "혼용" 경고는 오탐이 많아 하지 않는다.
 */
export function validateCardLanguage(e: NormalizedEvent, cardText: string): RawSmccIssue[] {
  const issues: RawSmccIssue[] = [];
  const config = PROGRAM_CONFIG[e.programType];
  if (config.allowAnyLanguage) return issues;
  const has = (s: string) => cardText.toLowerCase().replace(/\s+/g, '').includes(s.toLowerCase().replace(/\s+/g, ''));

  if (e.languageMode === 'EN') {
    // 프로그램명: 영문이어야 하는데 한글로 써있음
    if (has(config.nameKr)) {
      issues.push({
        category: 'language-mismatch',
        severity: 'error',
        title: '영문 카드에 한글 프로그램명',
        description: `언어가 English인 카드입니다. 프로그램명도 영문 "${config.nameEn}" 으로 표기하세요.`,
        expected: config.nameEn,
        actual: config.nameKr,
        confidence: 0.9,
        resolutionHint: `"${config.nameKr}" → "${config.nameEn}"`,
      });
    }
    // 참가조건: 영문이어야 하는데 한글("1인 1잔")로 써있음
    if (e.feeMode === 'free' && has('1인 1잔')) {
      issues.push({
        category: 'language-mismatch',
        severity: 'error',
        title: '영문 카드에 한글 참가조건',
        description: '언어가 English인 카드입니다. 참가조건도 영문 "Min. 1 Drink" 으로 표기하세요.',
        expected: 'Min. 1 Drink',
        actual: '1인 1잔',
        confidence: 0.9,
        resolutionHint: '"1인 1잔" → "Min. 1 Drink"',
      });
    }
  } else {
    // 프로그램명: 한글이어야 하는데 영문으로 써있음
    if (has(config.nameEn) && !has(config.nameKr)) {
      issues.push({
        category: 'language-mismatch',
        severity: 'error',
        title: '한글 카드에 영문 프로그램명',
        description: `언어가 한국어인 카드입니다. 프로그램명도 한글 "${config.nameKr}" 으로 표기하세요.`,
        expected: config.nameKr,
        actual: config.nameEn,
        confidence: 0.85,
        resolutionHint: `"${config.nameEn}" → "${config.nameKr}"`,
      });
    }
    // 참가조건: 한글이어야 하는데 영문("Min. 1 Drink")으로 써있음
    if (e.feeMode === 'free' && has('Min. 1 Drink')) {
      issues.push({
        category: 'language-mismatch',
        severity: 'error',
        title: '한글 카드에 영문 참가조건',
        description: '언어가 한국어인 카드입니다. 참가조건도 한글 "1인 1잔" 으로 표기하세요.',
        expected: '1인 1잔',
        actual: 'Min. 1 Drink',
        confidence: 0.85,
        resolutionHint: '"Min. 1 Drink" → "1인 1잔"',
      });
    }
  }
  return issues;
}
