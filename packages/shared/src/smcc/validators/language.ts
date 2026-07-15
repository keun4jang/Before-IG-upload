import { PROGRAM_CONFIG } from '../program-config';
import type { NormalizedEvent, RawSmccIssue } from '../schemas';

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 카드 텍스트에서 "원문 유지 허용" 영역(카페명/지점/주소/호스트)을 제거한 나머지 */
function stripAllowedOrigin(e: NormalizedEvent, cardText: string): string {
  let t = cardText;
  for (const field of [e.cafeName, e.cafeBranch, e.cafeAddress, e.hostInstagram, e.meetupSpotName, e.meetupSpotAddress]) {
    if (field && field.trim()) {
      t = t.replace(new RegExp(escapeRe(field), 'gi'), ' ');
    }
  }
  return t;
}

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
 * KR 카드에 금지되는 영어 UI 라벨 / EN 카드에 금지되는 한글 UI 라벨.
 * "Date"/"Meet at"는 SMCC 카드 템플릿 자체가 카드 언어와 무관하게 항상 영어로 고정
 * 표기하는 UI 라벨이라 여기서 제외한다(실제 카드 확인 결과, KR 카드에도 항상 영어로 나옴).
 */
const EN_LABELS_FORBIDDEN_IN_KR: Array<{ re: RegExp; word: string }> = [
  { re: /\btime\b/i, word: 'Time' },
  { re: /\blocation\b/i, word: 'Location' },
  { re: /\blanguage\b/i, word: 'Language' },
  { re: /\bfee\b/i, word: 'Fee' },
];

const KR_LABELS_FORBIDDEN_IN_EN: Array<{ re: RegExp; word: string }> = [
  { re: /날짜/, word: '날짜' },
  { re: /집결지|만나는\s*곳/, word: '집결지' },
  { re: /시간/, word: '시간' },
  { re: /언어/, word: '언어' },
  { re: /참가비/, word: '참가비' },
];

/**
 * [forbidden-label rule] 카드 안의 UI 라벨이 카드 언어와 다른 언어면 오류.
 * 예: KR 카드에 "Date", "Meet at" 같은 영어 라벨 — SMCC 규칙 위반.
 */
export function validateCardLabels(e: NormalizedEvent, cardText: string): RawSmccIssue[] {
  const issues: RawSmccIssue[] = [];
  const isKr = e.languageMode === 'KR';
  const list = isKr ? EN_LABELS_FORBIDDEN_IN_KR : KR_LABELS_FORBIDDEN_IN_EN;

  for (const item of list) {
    if (item.re.test(cardText)) {
      issues.push({
        category: 'language-mismatch',
        severity: 'error',
        title: isKr ? 'KR 카드에 영어 라벨 사용' : 'EN 카드에 한글 라벨 사용',
        description: `"${item.word}" 라벨은 이 카드 언어에 맞지 않습니다.`,
        actual: item.word,
        confidence: 0.85,
        resolutionHint: isKr ? '라벨을 한글로 바꾸거나 제거하세요.' : 'Remove or translate the label.',
      });
    }
  }
  return issues;
}

/**
 * [mixed-language rule] 카드 전체 수준의 언어 혼용 검사(soft).
 * 카페명/지점/주소/호스트/집결지 등 "원문 유지 허용" 영역을 제외한 나머지에서
 * 카드 언어와 다른 언어 비중이 높으면 경고.
 */
export function validateCardLanguage(e: NormalizedEvent, cardText: string): RawSmccIssue[] {
  const issues: RawSmccIssue[] = [];
  const config = PROGRAM_CONFIG[e.programType];
  const cleaned = stripAllowedOrigin(e, cardText);

  if (e.languageMode === 'EN') {
    // EN 카드에 한국어 프로그램명 사용 → 오류
    if (cardText.includes(config.nameKr)) {
      issues.push({
        category: 'language-mismatch',
        severity: 'error',
        title: 'EN 카드에 한국어 프로그램명',
        description: '영문 카드에는 영문 프로그램명을 사용하세요.',
        expected: config.nameEn,
        actual: config.nameKr,
        confidence: 0.9,
      });
    }
    if (/[가-힣]{2,}/.test(cleaned)) {
      issues.push({
        category: 'language-mismatch',
        severity: 'warning',
        title: '영문 카드에 한국어 혼용',
        description: '카페명·고유명사를 제외한 한국어가 있는지 확인하세요.',
        confidence: 0.55,
      });
    }
  } else {
    // KR 카드에 영문 프로그램명
    if (cardText.includes(config.nameEn) && !cardText.includes(config.nameKr)) {
      issues.push({
        category: 'language-mismatch',
        severity: 'error',
        title: 'KR 카드에 영문 프로그램명',
        description: '한글 카드에는 한글 프로그램명을 사용하세요.',
        expected: config.nameKr,
        actual: config.nameEn,
        confidence: 0.8,
      });
    }
    // 원문 유지 허용 영역을 제외하고도 남는 영어 단어 수 (강화: 임계값 하향 + 경고로 격상)
    const latinCount = (cleaned.match(/[A-Za-z]{3,}/g) ?? []).length;
    if (latinCount >= 3) {
      issues.push({
        category: 'language-mismatch',
        severity: 'warning',
        title: '한글 카드에 영어 혼용',
        description: '카페명·고유명사 외 영어 표현이 있는지 확인하세요.',
        confidence: 0.5,
      });
    }
  }
  return issues;
}
