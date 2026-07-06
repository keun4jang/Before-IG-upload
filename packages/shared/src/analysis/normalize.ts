/**
 * 텍스트 정규화 및 문장 분리 유틸.
 * 한국어 카드뉴스 텍스트를 다루는 데 최적화되어 있습니다.
 */

/** 다양한 공백/제어문자를 표준 공백으로, 연속 공백을 하나로. */
export function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    .replace(/[ ​﻿]/g, ' ') // nbsp, zero-width space, BOM
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 비교용 정규화: 공백·문장부호 제거, 소문자화. 중복 탐지의 normalized match에 사용. */
export function canonicalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[.,!?~…·・:;'"“”‘’()[\]{}<>`\-–—_/\\]+/g, '');
}

export interface Sentence {
  text: string;
  start: number;
  end: number;
}

/**
 * 문장 단위 분리. 한국어 종결부호(. ! ? …)와 줄바꿈을 경계로 사용하되,
 * 카드뉴스는 종결부호 없이 줄바꿈만 있는 경우가 많아 줄바꿈도 경계로 취급.
 */
export function splitSentences(input: string): Sentence[] {
  const text = input.replace(/\r\n?/g, '\n');
  const sentences: Sentence[] = [];
  const boundary = /([.!?…]+[)\]"'”’]?\s+|\n+)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = boundary.exec(text)) !== null) {
    const end = match.index + match[0].length;
    const raw = text.slice(lastIndex, end);
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      const leading = raw.length - raw.trimStart().length;
      const start = lastIndex + leading;
      sentences.push({ text: trimmed, start, end: start + trimmed.length });
    }
    lastIndex = end;
  }
  const tail = text.slice(lastIndex);
  const trimmedTail = tail.trim();
  if (trimmedTail.length > 0) {
    const leading = tail.length - tail.trimStart().length;
    const start = lastIndex + leading;
    sentences.push({ text: trimmedTail, start, end: start + trimmedTail.length });
  }
  return sentences;
}

/** 한글/영문/숫자 토큰 추출 (키워드 빈도 분석용). */
export function tokenize(input: string): string[] {
  const matches = input.toLowerCase().match(/[가-힣]+|[a-z]+|[0-9]+/g);
  return matches ?? [];
}

/** 의미 없는 불용어(조사/접속어 등 대표적인 것). */
export const STOPWORDS = new Set([
  '그리고',
  '그러나',
  '하지만',
  '그래서',
  '또는',
  '및',
  '수',
  '것',
  '등',
  '더',
  '이',
  '그',
  '저',
  '때',
  '중',
  '내',
  '위',
  '아주',
  '정말',
  '너무',
  '이런',
  '저런',
  '그런',
  'the',
  'and',
  'for',
  'you',
  'your',
]);

/** trigram 집합 (fuzzy 유사도용). */
export function trigrams(input: string): Set<string> {
  const s = canonicalize(input);
  const grams = new Set<string>();
  if (s.length < 3) {
    if (s.length > 0) grams.add(s);
    return grams;
  }
  for (let i = 0; i <= s.length - 3; i++) {
    grams.add(s.slice(i, i + 3));
  }
  return grams;
}

/** Jaccard 유사도 (0~1). */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) {
    if (b.has(x)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
