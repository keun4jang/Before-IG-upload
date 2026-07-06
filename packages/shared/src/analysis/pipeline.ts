/**
 * 분석 파이프라인 오케스트레이터.
 * web(동기) / worker(비동기 큐) 양쪽에서 동일하게 재사용됩니다.
 */
import { normalizeWhitespace } from './normalize';
import { checkConsistency, proofreadText } from './proofread';
import { detectDuplication, type TextUnit } from './duplication';
import {
  buildClaimChecks,
  claimToIssue,
  extractClaims,
  type FactCheckOptions,
} from './claims';
import { computeScore, summarize } from './scoring';
import type {
  AnalysisInput,
  AnalysisProgress,
  AnalysisResult,
  ChecklistItem,
  Issue,
  RawIssue,
} from '../types';

export interface PipelineOptions extends FactCheckOptions {
  onProgress?: (progress: AnalysisProgress) => void;
  now?: () => Date;
}

export async function runAnalysis(
  input: AnalysisInput,
  opts: PipelineOptions = {},
): Promise<AnalysisResult> {
  const now = opts.now ?? (() => new Date());
  const report = (progress: AnalysisProgress) => opts.onProgress?.(progress);

  report({ step: 'prepare', percent: 5, message: '분석 준비 중' });

  // 1) 텍스트 유닛 구성 + 정규화
  const units: TextUnit[] = input.slides.map((s) => ({
    scopeRefId: String(s.slideNumber),
    text: normalizeWhitespace(s.text),
  }));
  if (input.captionText && input.captionText.trim()) {
    units.push({ scopeRefId: 'caption', text: normalizeWhitespace(input.captionText) });
  }
  report({ step: 'normalize', percent: 30, message: '텍스트 정리 완료' });

  const rawIssues: RawIssue[] = [];

  // 2) 오타/문법/표현/문장부호
  for (const unit of units) {
    const scopeType = unit.scopeRefId === 'caption' ? 'caption' : 'slide';
    rawIssues.push(...proofreadText(unit.text, scopeType, unit.scopeRefId));
  }
  const fullText = units.map((u) => u.text).join('\n');
  rawIssues.push(...checkConsistency(fullText));
  report({ step: 'proofread', percent: 55, message: '오타·문법 검사 완료' });

  // 3) 중복/유사
  const dup = detectDuplication(units);
  rawIssues.push(...dup.issues);
  report({ step: 'duplication', percent: 72, message: '중복 탐지 완료' });

  // 4) 사실 검토
  let claimCount = 0;
  if (input.factCheckEnabled !== false) {
    const candidates = extractClaims(units);
    claimCount = candidates.length;
    const checks = await buildClaimChecks(candidates, { search: opts.search, llm: opts.llm, now });
    for (let i = 0; i < candidates.length; i++) {
      rawIssues.push(claimToIssue(candidates[i]!, checks[i]!));
    }
  }
  report({ step: 'factcheck', percent: 90, message: '사실 검토 완료' });

  // 5) 이슈 id 부여
  const issues: Issue[] = rawIssues.map((raw, i) => ({
    ...raw,
    id: `iss_${i + 1}`,
    isResolved: false,
  }));

  // 6) 점수/요약/체크리스트
  const slideNumbers = input.slides.map((s) => s.slideNumber);
  const score = computeScore(issues, slideNumbers);
  const summary = summarize(issues, claimCount, dup.pairs.length, dup.keywords);
  const checklist = buildChecklist(issues, input);

  report({ step: 'finalize', percent: 100, message: '결과 정리 완료' });

  return {
    issues,
    duplicationPairs: dup.pairs,
    score,
    summary,
    checklist,
    generatedAt: now().toISOString(),
  };
}

function buildChecklist(issues: Issue[], input: AnalysisInput): ChecklistItem[] {
  const spellingIssues = issues.filter((i) =>
    ['spelling', 'spacing', 'grammar', 'punctuation'].includes(i.category),
  );
  const dupIssues = issues.filter((i) => i.category === 'duplication');
  const factIssues = issues.filter((i) => i.category === 'fact');
  const captionIssues = issues.filter((i) => i.scopeType === 'caption');
  const hasCaption = !!(input.captionText && input.captionText.trim());

  const items: ChecklistItem[] = [
    {
      key: 'spelling',
      label: '오타 · 띄어쓰기 확인',
      passed: spellingIssues.length === 0,
      detail:
        spellingIssues.length === 0
          ? '발견된 맞춤법 이슈가 없습니다.'
          : `${spellingIssues.length}건의 오타/띄어쓰기 제안이 있습니다.`,
    },
    {
      key: 'duplication',
      label: '중복 · 반복 표현 확인',
      passed: dupIssues.length === 0,
      detail:
        dupIssues.length === 0
          ? '중복/유사 표현이 발견되지 않았습니다.'
          : `${dupIssues.length}건의 중복/유사 항목을 확인하세요.`,
    },
    {
      key: 'fact',
      label: '사실 근거 확인',
      passed: factIssues.every((i) => i.isResolved),
      detail:
        factIssues.length === 0
          ? '사실 검토가 필요한 문장이 없습니다.'
          : `${factIssues.length}개 문장은 출처 재확인을 권장합니다.`,
    },
    {
      key: 'caption',
      label: '캡션 확인',
      passed: hasCaption ? captionIssues.length === 0 : true,
      detail: !hasCaption
        ? '캡션이 입력되지 않았습니다.'
        : captionIssues.length === 0
          ? '캡션에서 발견된 이슈가 없습니다.'
          : `캡션에서 ${captionIssues.length}건의 이슈가 있습니다.`,
    },
  ];

  const ready = items.every((i) => i.passed);
  items.push({
    key: 'ready',
    label: '업로드 준비 완료',
    passed: ready,
    detail: ready
      ? '주요 항목이 모두 확인되었습니다. 그래도 중요한 정보는 원출처를 다시 확인하세요.'
      : '위 항목을 확인/처리한 뒤 업로드하는 것을 권장합니다.',
  });

  return items;
}
