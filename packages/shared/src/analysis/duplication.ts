/**
 * 중복 / 유사 표현 탐지.
 * - exact: 완전 일치
 * - normalized: 공백/문장부호 제거 후 일치
 * - similar: trigram Jaccard 유사도 기반
 * - intentional: 짧은 CTA성 반복(의도된 반복 가능성)
 */
import type {
  DuplicationKind,
  DuplicationPair,
  KeywordFrequency,
  RawIssue,
} from '../types';
import { canonicalize, jaccard, splitSentences, STOPWORDS, tokenize, trigrams } from './normalize';

export interface TextUnit {
  scopeRefId: string; // 슬라이드 번호 문자열 또는 'caption'
  text: string;
}

const SIMILAR_THRESHOLD = 0.6;
const MIN_CANON_LEN = 8; // 너무 짧은 문장은 비교 제외
const CTA_MAX_LEN = 14; // 이보다 짧으면 의도된 반복으로 간주

interface IndexedSentence {
  scopeRefId: string;
  text: string;
  canon: string;
  grams: Set<string>;
  start: number;
  end: number;
}

export interface DuplicationResult {
  pairs: DuplicationPair[];
  issues: RawIssue[];
  keywords: KeywordFrequency[];
}

export function detectDuplication(units: TextUnit[]): DuplicationResult {
  const sentences: IndexedSentence[] = [];
  for (const unit of units) {
    for (const s of splitSentences(unit.text)) {
      const canon = canonicalize(s.text);
      if (canon.length < MIN_CANON_LEN) continue;
      sentences.push({
        scopeRefId: unit.scopeRefId,
        text: s.text,
        canon,
        grams: trigrams(s.text),
        start: s.start,
        end: s.end,
      });
    }
  }

  const pairs: DuplicationPair[] = [];
  const issues: RawIssue[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < sentences.length; i++) {
    for (let j = i + 1; j < sentences.length; j++) {
      const a = sentences[i]!;
      const b = sentences[j]!;

      let kind: DuplicationKind | null = null;
      let similarity = 0;

      if (a.text === b.text) {
        kind = a.canon.length <= CTA_MAX_LEN ? 'intentional' : 'exact';
        similarity = 1;
      } else if (a.canon === b.canon) {
        kind = 'normalized';
        similarity = 1;
      } else {
        similarity = jaccard(a.grams, b.grams);
        if (similarity >= SIMILAR_THRESHOLD) kind = 'similar';
      }

      if (!kind) continue;

      const dedupeKey = `${a.canon}|${b.canon}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      pairs.push({
        kind,
        similarity: Math.round(similarity * 100) / 100,
        a: { scopeRefId: a.scopeRefId, text: a.text, start: a.start, end: a.end },
        b: { scopeRefId: b.scopeRefId, text: b.text, start: b.start, end: b.end },
      });

      const severity = kind === 'exact' || kind === 'normalized' ? 'medium' : 'low';
      const kindLabel: Record<DuplicationKind, string> = {
        exact: '중복 문장',
        normalized: '사실상 중복(공백·부호 제외 일치)',
        similar: '유사 문장',
        intentional: '반복 문구(의도된 반복 가능성)',
      };
      const scopeLabel =
        a.scopeRefId === b.scopeRefId
          ? `같은 위치 내 반복`
          : `${scopeName(a.scopeRefId)} ↔ ${scopeName(b.scopeRefId)}`;

      issues.push({
        scopeType: b.scopeRefId === 'caption' ? 'caption' : 'slide',
        scopeRefId: b.scopeRefId,
        category: 'duplication',
        severity,
        confidence: kind === 'similar' ? similarity : 0.9,
        sourceText: b.text,
        suggestedText: kind === 'intentional' ? undefined : '문구를 다르게 바꾸거나 하나로 정리하세요.',
        explanation: `${kindLabel[kind]} — ${scopeLabel} (유사도 ${Math.round(similarity * 100)}%)\n· "${a.text}"`,
        location: {
          scopeType: b.scopeRefId === 'caption' ? 'caption' : 'slide',
          scopeRefId: b.scopeRefId,
          start: b.start,
          end: b.end,
          excerpt: b.text,
        },
      });
    }
  }

  // 반복 키워드 분석
  const counts = new Map<string, number>();
  for (const unit of units) {
    for (const tk of tokenize(unit.text)) {
      if (tk.length < 2 || STOPWORDS.has(tk)) continue;
      counts.set(tk, (counts.get(tk) ?? 0) + 1);
    }
  }
  const keywords: KeywordFrequency[] = [...counts.entries()]
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((x, y) => y.count - x.count)
    .slice(0, 8);

  for (const kw of keywords) {
    if (kw.count >= 6) {
      issues.push({
        scopeType: 'project',
        scopeRefId: 'project',
        category: 'duplication',
        severity: 'low',
        confidence: 0.5,
        sourceText: `"${kw.keyword}" ${kw.count}회`,
        suggestedText: '동의어로 바꾸거나 사용 횟수를 줄여보세요.',
        explanation: `키워드 "${kw.keyword}"가 프로젝트 전체에서 ${kw.count}회 반복됩니다.`,
      });
    }
  }

  // 해시태그 중복 (캡션)
  const caption = units.find((u) => u.scopeRefId === 'caption');
  if (caption) {
    const tags = caption.text.match(/#[^\s#]+/g) ?? [];
    const tagCount = new Map<string, number>();
    for (const t of tags) {
      const key = t.toLowerCase();
      tagCount.set(key, (tagCount.get(key) ?? 0) + 1);
    }
    for (const [tag, count] of tagCount) {
      if (count > 1) {
        issues.push({
          scopeType: 'caption',
          scopeRefId: 'caption',
          category: 'duplication',
          severity: 'low',
          confidence: 0.95,
          sourceText: `${tag} ×${count}`,
          suggestedText: '중복 해시태그를 제거하세요.',
          explanation: `해시태그 "${tag}"가 ${count}번 사용되었습니다.`,
        });
      }
    }
  }

  return { pairs, issues, keywords };
}

function scopeName(scopeRefId: string): string {
  return scopeRefId === 'caption' ? '캡션' : `슬라이드 ${scopeRefId}`;
}
