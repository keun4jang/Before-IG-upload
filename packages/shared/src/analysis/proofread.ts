/**
 * 오타 / 띄어쓰기 / 문법 / 표현 / 문장부호 / 표기 일관성 검사 (로컬 규칙 기반).
 *
 * 완벽한 한국어 맞춤법 검사는 불가능하므로, 오탐(false positive)을 줄이기 위해
 * 신뢰도(confidence)를 낮게 잡고 "제안"으로만 제시합니다. 단정하지 않습니다.
 */
import type { RawIssue, ScopeType, TextLocation } from '../types';
import { splitSentences } from './normalize';

function loc(
  scopeType: ScopeType,
  scopeRefId: string,
  start: number,
  end: number,
  full: string,
): TextLocation {
  return {
    scopeType,
    scopeRefId,
    start,
    end,
    excerpt: full.slice(Math.max(0, start - 6), Math.min(full.length, end + 6)),
  };
}

/** 자주 틀리는 띄어쓰기/맞춤법 (보수적 큐레이션). */
const SPELLING_RULES: Array<{
  pattern: RegExp;
  suggest: string;
  category: RawIssue['category'];
  explanation: string;
  confidence: number;
}> = [
  { pattern: /할수있/g, suggest: '할 수 있', category: 'spacing', explanation: '"수"는 의존명사로 앞말과 띄어 씁니다.', confidence: 0.85 },
  { pattern: /할수없/g, suggest: '할 수 없', category: 'spacing', explanation: '"수"는 의존명사로 앞말과 띄어 씁니다.', confidence: 0.85 },
  { pattern: /될수있/g, suggest: '될 수 있', category: 'spacing', explanation: '"수"는 의존명사로 앞말과 띄어 씁니다.', confidence: 0.85 },
  { pattern: /갈수있/g, suggest: '갈 수 있', category: 'spacing', explanation: '"수"는 의존명사로 앞말과 띄어 씁니다.', confidence: 0.85 },
  { pattern: /안되/g, suggest: '안 되', category: 'spacing', explanation: '부정의 "안"은 뒷말과 띄어 씁니다. (문맥상 "안 되다")', confidence: 0.5 },
  { pattern: /몇일/g, suggest: '며칠', category: 'spelling', explanation: '"몇 일"이 아니라 "며칠"이 표준입니다.', confidence: 0.9 },
  { pattern: /되요/g, suggest: '돼요', category: 'spelling', explanation: '"되어요"의 준말은 "돼요"입니다.', confidence: 0.85 },
  { pattern: /안되요/g, suggest: '안 돼요', category: 'spelling', explanation: '"안 되어요 → 안 돼요"가 맞습니다.', confidence: 0.85 },
  { pattern: /어의없/g, suggest: '어이없', category: 'spelling', explanation: '"어이없다"가 표준입니다.', confidence: 0.9 },
  { pattern: /금새/g, suggest: '금세', category: 'spelling', explanation: '"금세"가 표준입니다. ("금시에"의 준말)', confidence: 0.9 },
  { pattern: /역활/g, suggest: '역할', category: 'spelling', explanation: '"역할"이 표준입니다.', confidence: 0.95 },
  { pattern: /설레임/g, suggest: '설렘', category: 'spelling', explanation: '"설렘"이 표준입니다.', confidence: 0.9 },
  { pattern: /바램/g, suggest: '바람', category: 'spelling', explanation: '희망의 뜻은 "바람"이 표준입니다.', confidence: 0.7 },
  { pattern: /틀리게/g, suggest: '다르게', category: 'grammar', explanation: '비교의 의미라면 "틀리다"가 아니라 "다르다"가 맞습니다.', confidence: 0.5 },
  { pattern: /(?<![가-힣])예기(?![가-힣])/g, suggest: '얘기', category: 'spelling', explanation: '구어의 "이야기"는 "얘기"입니다.', confidence: 0.6 },
  { pattern: /낫는/g, suggest: '낮는/나은', category: 'spelling', explanation: '문맥에 따라 "나은"(더 좋은) 또는 다른 표현이 필요할 수 있습니다.', confidence: 0.4 },
];

/** 과장/금칙어(리스크) — 표현을 완곡하게 다듬도록 제안. */
const RISK_TERMS: Array<{ term: string; suggest: string; explanation: string }> = [
  { term: '100%', suggest: '대부분 / 상당수', explanation: '"100%" 단정 표현은 근거가 없으면 과장으로 읽힐 수 있습니다.' },
  { term: '무조건', suggest: '대체로 / 상황에 따라', explanation: '단정적 표현입니다. 근거가 없으면 완화하세요.' },
  { term: '완벽', suggest: '충실한 / 꼼꼼한', explanation: '과장 표현일 수 있습니다.' },
  { term: '최고', suggest: '뛰어난 / 손꼽히는', explanation: '비교 근거가 없으면 과장으로 보일 수 있습니다.' },
  { term: '유일', suggest: '보기 드문', explanation: '"유일"은 사실 확인이 필요한 강한 주장입니다.' },
  { term: '보장', suggest: '기대할 수 있는', explanation: '결과 보장 표현은 오해를 부를 수 있습니다.' },
  { term: '절대', suggest: '거의 / 웬만하면', explanation: '단정적 표현입니다.' },
  { term: '1등', suggest: '상위권', explanation: '순위 주장은 출처가 필요합니다.' },
  { term: '평생', suggest: '오래', explanation: '"평생" 보장류 표현은 과장일 수 있습니다.' },
];

export function proofreadText(
  text: string,
  scopeType: ScopeType,
  scopeRefId: string,
): RawIssue[] {
  const issues: RawIssue[] = [];
  if (!text.trim()) return issues;

  // 1) 큐레이션된 맞춤법/띄어쓰기 규칙
  for (const rule of SPELLING_RULES) {
    rule.pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.pattern.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      issues.push({
        scopeType,
        scopeRefId,
        category: rule.category,
        severity: rule.category === 'spelling' ? 'medium' : 'low',
        confidence: rule.confidence,
        sourceText: m[0],
        suggestedText: rule.suggest,
        explanation: rule.explanation,
        location: loc(scopeType, scopeRefId, start, end, text),
      });
      if (m.index === rule.pattern.lastIndex) rule.pattern.lastIndex++;
    }
  }

  // 2) 문장부호 과다 (!!! ??? .. 등)
  for (const re of [/!{2,}/g, /\?{2,}/g, /(?<!\.)\.\.(?!\.)/g, /~{2,}/g]) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      issues.push({
        scopeType,
        scopeRefId,
        category: 'punctuation',
        severity: 'low',
        confidence: 0.75,
        sourceText: m[0],
        suggestedText: m[0][0],
        explanation: '문장부호가 반복되었습니다. 하나로 줄이면 더 깔끔합니다.',
        location: loc(scopeType, scopeRefId, m.index, m.index + m[0].length, text),
      });
    }
  }

  // 3) 말줄임표 표기 (...) → (…)
  {
    const re = /\.{3}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      issues.push({
        scopeType,
        scopeRefId,
        category: 'punctuation',
        severity: 'low',
        confidence: 0.6,
        sourceText: '...',
        suggestedText: '…',
        explanation: '말줄임표는 가운데점 세 개(…) 기호 사용을 권장합니다.',
        location: loc(scopeType, scopeRefId, m.index, m.index + 3, text),
      });
    }
  }

  // 4) 과장/금칙어
  for (const risk of RISK_TERMS) {
    let from = 0;
    let idx: number;
    while ((idx = text.indexOf(risk.term, from)) !== -1) {
      issues.push({
        scopeType,
        scopeRefId,
        category: 'risk',
        severity: 'medium',
        confidence: 0.55,
        sourceText: risk.term,
        suggestedText: risk.suggest,
        explanation: risk.explanation,
        location: loc(scopeType, scopeRefId, idx, idx + risk.term.length, text),
      });
      from = idx + risk.term.length;
    }
  }

  // 5) 문장 단위 검사: 너무 긴 문장 / 반복 단어
  for (const s of splitSentences(text)) {
    if (s.text.replace(/\s/g, '').length > 60) {
      issues.push({
        scopeType,
        scopeRefId,
        category: 'style',
        severity: 'low',
        confidence: 0.6,
        sourceText: s.text,
        explanation: '문장이 깁니다. 두 문장으로 나누면 가독성이 좋아집니다.',
        location: loc(scopeType, scopeRefId, s.start, s.end, text),
      });
    }
    // 인접 단어 반복 (예: "정말 정말")
    const repRe = /([가-힣A-Za-z]{2,})\s+\1/g;
    let rm: RegExpExecArray | null;
    while ((rm = repRe.exec(s.text)) !== null) {
      const start = s.start + rm.index;
      issues.push({
        scopeType,
        scopeRefId,
        category: 'style',
        severity: 'low',
        confidence: 0.7,
        sourceText: rm[0],
        suggestedText: rm[1],
        explanation: '같은 단어가 연달아 반복됩니다.',
        location: loc(scopeType, scopeRefId, start, start + rm[0].length, text),
      });
    }
  }

  return issues;
}

/**
 * 숫자/단위 표기 일관성 검사 (프로젝트 전체 텍스트 대상).
 * 예: "%" 와 "퍼센트" 혼용, 천단위 콤마 혼용 등.
 */
export function checkConsistency(fullText: string): RawIssue[] {
  const issues: RawIssue[] = [];
  const scopeType: ScopeType = 'project';
  const scopeRefId = 'project';

  const hasPercentSign = /\d\s*%/.test(fullText);
  const hasPercentWord = /퍼센트|프로(?![가-힣])/.test(fullText);
  if (hasPercentSign && hasPercentWord) {
    issues.push({
      scopeType,
      scopeRefId,
      category: 'consistency',
      severity: 'low',
      confidence: 0.7,
      sourceText: '% / 퍼센트 혼용',
      suggestedText: '한 가지 표기로 통일',
      explanation: '백분율 표기가 "%"와 "퍼센트"로 섞여 있습니다. 하나로 통일하세요.',
    });
  }

  // 천단위 콤마 혼용: 4자리 이상 숫자 중 콤마 있는 것과 없는 것이 공존
  const plainBig = /(?<![\d,])\d{4,}(?![\d,])/.test(fullText);
  const commaBig = /\d{1,3}(,\d{3})+/.test(fullText);
  if (plainBig && commaBig) {
    issues.push({
      scopeType,
      scopeRefId,
      category: 'consistency',
      severity: 'low',
      confidence: 0.6,
      sourceText: '천단위 구분(,) 혼용',
      suggestedText: '천단위 콤마 사용 여부 통일',
      explanation: '큰 숫자에 천단위 콤마가 있는 곳과 없는 곳이 섞여 있습니다.',
    });
  }

  return issues;
}
