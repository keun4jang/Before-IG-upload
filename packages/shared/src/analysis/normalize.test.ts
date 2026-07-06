import { describe, expect, it } from 'vitest';
import {
  canonicalize,
  jaccard,
  normalizeWhitespace,
  splitSentences,
  tokenize,
  trigrams,
} from './normalize';

describe('normalizeWhitespace', () => {
  it('연속 공백과 줄바꿈을 정리한다', () => {
    expect(normalizeWhitespace('가   나\t다')).toBe('가 나 다');
    expect(normalizeWhitespace('가\n\n\n\n나')).toBe('가\n\n나');
  });
});

describe('canonicalize', () => {
  it('공백과 문장부호를 제거한다', () => {
    expect(canonicalize('안녕! 하세요.')).toBe('안녕하세요');
    expect(canonicalize('Hello, World')).toBe('helloworld');
  });
});

describe('splitSentences', () => {
  it('종결부호와 줄바꿈으로 분리한다', () => {
    const s = splitSentences('첫 문장이다. 두 번째!\n세 번째');
    expect(s.map((x) => x.text)).toEqual(['첫 문장이다.', '두 번째!', '세 번째']);
  });

  it('offset이 원문 위치를 가리킨다', () => {
    const text = '가나다. 라마바';
    const s = splitSentences(text);
    expect(text.slice(s[1]!.start, s[1]!.end)).toBe('라마바');
  });
});

describe('tokenize', () => {
  it('한글/영문/숫자 토큰을 추출한다', () => {
    expect(tokenize('건강 Water 8잔')).toEqual(['건강', 'water', '8', '잔']);
  });
});

describe('jaccard / trigrams', () => {
  it('동일 문자열의 유사도는 1', () => {
    expect(jaccard(trigrams('매일 아침 스트레칭'), trigrams('매일 아침 스트레칭'))).toBe(1);
  });
  it('유사 문장은 높은 유사도', () => {
    const sim = jaccard(trigrams('매일 아침 스트레칭은 좋다'), trigrams('매일 아침 스트레칭은 건강에 좋다'));
    expect(sim).toBeGreaterThanOrEqual(0.45);
  });
  it('무관한 문장은 낮은 유사도', () => {
    const sim = jaccard(trigrams('오늘 날씨가 맑다'), trigrams('투자 수익률이 높다'));
    expect(sim).toBeLessThan(0.2);
  });
});
