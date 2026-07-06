import { describe, expect, it } from 'vitest';
import { detectDuplication } from './duplication';
import { proofreadText, checkConsistency } from './proofread';
import { extractClaims, buildClaimChecks } from './claims';
import { computeScore } from './scoring';
import { runAnalysis } from './pipeline';
import { DEMO_CAPTION, DEMO_SLIDES } from '../demo';
import type { Issue } from '../types';

describe('proofreadText', () => {
  it('과장 표현(100%, 무조건)을 risk로 잡는다', () => {
    const issues = proofreadText('100% 무조건 됩니다', 'slide', '1');
    const risk = issues.filter((i) => i.category === 'risk');
    expect(risk.length).toBeGreaterThanOrEqual(2);
  });

  it('띄어쓰기(할수있)를 잡고 제안을 준다', () => {
    const issues = proofreadText('나는 할수있다', 'slide', '1');
    const spacing = issues.find((i) => i.category === 'spacing');
    expect(spacing?.suggestedText).toContain('할 수 있');
  });

  it('반복 문장부호를 잡는다', () => {
    const issues = proofreadText('대박!!!', 'slide', '1');
    expect(issues.some((i) => i.category === 'punctuation')).toBe(true);
  });
});

describe('checkConsistency', () => {
  it('% 와 퍼센트 혼용을 잡는다', () => {
    const issues = checkConsistency('30% 상승, 20퍼센트 하락');
    expect(issues.some((i) => i.category === 'consistency')).toBe(true);
  });
});

describe('detectDuplication', () => {
  it('완전히 같은 문장을 중복으로 탐지한다', () => {
    const res = detectDuplication([
      { scopeRefId: '1', text: '매일 아침 스트레칭은 건강에 좋습니다.' },
      { scopeRefId: '2', text: '매일 아침 스트레칭은 건강에 좋습니다.' },
    ]);
    expect(res.pairs.length).toBe(1);
    expect(res.pairs[0]!.kind === 'exact' || res.pairs[0]!.kind === 'intentional').toBe(true);
  });

  it('해시태그 중복을 잡는다', () => {
    const res = detectDuplication([{ scopeRefId: 'caption', text: '#건강 #운동 #건강' }]);
    expect(res.issues.some((i) => i.explanation.includes('#건강'))).toBe(true);
  });
});

describe('extractClaims + buildClaimChecks', () => {
  it('통계/의료 문장을 claim으로 추출한다', () => {
    const claims = extractClaims([
      { scopeRefId: '1', text: '신진대사가 30% 올라갑니다.' },
      { scopeRefId: '2', text: '이 방법은 효과가 있습니다.' },
    ]);
    expect(claims.length).toBe(2);
    expect(claims.some((c) => c.highRisk)).toBe(true);
  });

  it('출처 없으면 review_needed(단정 금지)', async () => {
    const claims = extractClaims([{ scopeRefId: '1', text: '수익률이 20% 보장됩니다.' }]);
    const checks = await buildClaimChecks(claims);
    expect(checks[0]!.verdict).toBe('review_needed');
    expect(checks[0]!.highRisk).toBe(true);
  });

  it('고위험 영역은 mostly_supported로 단정하지 않는다', async () => {
    const claims = extractClaims([{ scopeRefId: '1', text: '이 약은 암을 치료합니다.' }]);
    const checks = await buildClaimChecks(claims, {
      search: async () => [
        { title: 's1', url: 'http://a', snippet: '...' },
        { title: 's2', url: 'http://b', snippet: '...' },
      ],
      llm: async () => ({ verdict: 'mostly_supported', rationale: 'ok', confidence: 0.9 }),
    });
    expect(checks[0]!.verdict).not.toBe('mostly_supported');
    expect(checks[0]!.confidence).toBeLessThanOrEqual(0.6);
  });
});

describe('computeScore', () => {
  it('이슈가 없으면 100점', () => {
    expect(computeScore([], [1, 2]).overall).toBe(100);
  });

  it('high severity 이슈는 크게 감점된다', () => {
    const issue: Issue = {
      id: 'x',
      scopeType: 'slide',
      scopeRefId: '1',
      category: 'fact',
      severity: 'high',
      confidence: 1,
      sourceText: 't',
      explanation: 'e',
      isResolved: false,
    };
    const score = computeScore([issue], [1]);
    expect(score.overall).toBeLessThan(90);
  });
});

describe('runAnalysis (통합)', () => {
  it('데모 데이터로 전체 파이프라인이 결과를 만든다', async () => {
    const result = await runAnalysis({
      slides: DEMO_SLIDES.map((s) => ({ slideNumber: s.slideNumber, text: s.text })),
      captionText: DEMO_CAPTION,
      factCheckEnabled: true,
    });
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.score.overall).toBeGreaterThanOrEqual(0);
    expect(result.score.overall).toBeLessThanOrEqual(100);
    expect(result.checklist.length).toBe(5);
    // 중복 슬라이드(3번)가 탐지되어야 함
    expect(result.duplicationPairs.length).toBeGreaterThan(0);
    // 사실 검토 대상(통계/의료)이 있어야 함
    expect(result.summary.claimCount).toBeGreaterThan(0);
  });
});
