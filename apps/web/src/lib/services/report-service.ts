/**
 * 리포트 생성 서비스: Markdown / JSON / 인쇄용 HTML.
 */
import {
  CATEGORY_LABELS,
  SCORE_LABELS,
  SEVERITY_LABELS,
  VERDICT_LABELS,
  SAFETY_NOTICE,
  type AnalysisResult,
  type Issue,
} from '@big/shared';
import type { ProjectDetail } from '../store/types';

function scopeName(issue: Issue): string {
  if (issue.scopeType === 'caption') return '캡션';
  if (issue.scopeType === 'project') return '프로젝트 전체';
  return `슬라이드 ${issue.scopeRefId}`;
}

export function toMarkdown(detail: ProjectDetail, result: AnalysisResult): string {
  const lines: string[] = [];
  lines.push(`# 업로드 전 검수 리포트 — ${detail.project.name}`);
  lines.push('');
  lines.push(`- 전체 점수: **${result.score.overall}점** (${SCORE_LABELS[result.score.label]})`);
  lines.push(`- 총 이슈: ${result.summary.totalIssues}건 (높음 ${result.summary.bySeverity.high} · 중간 ${result.summary.bySeverity.medium} · 낮음 ${result.summary.bySeverity.low})`);
  lines.push(`- 사실 검토 대상: ${result.summary.claimCount}문장 · 중복 쌍: ${result.summary.duplicatePairCount}건`);
  lines.push(`- 생성 시각: ${new Date(result.generatedAt).toLocaleString('ko-KR')}`);
  lines.push('');
  lines.push('## ✅ 업로드 전 체크리스트');
  for (const c of result.checklist) {
    lines.push(`- [${c.passed ? 'x' : ' '}] ${c.label} — ${c.detail}`);
  }
  lines.push('');
  lines.push('## 🔎 발견된 이슈');
  if (result.issues.length === 0) {
    lines.push('발견된 이슈가 없습니다.');
  }
  for (const issue of result.issues) {
    lines.push(`### [${CATEGORY_LABELS[issue.category]}] ${scopeName(issue)} · 심각도 ${SEVERITY_LABELS[issue.severity]}`);
    lines.push(`- 원문: ${issue.sourceText}`);
    if (issue.suggestedText) lines.push(`- 제안: ${issue.suggestedText}`);
    lines.push(`- 설명: ${issue.explanation.replace(/\n/g, ' ')}`);
    if (issue.claim) {
      lines.push(`- 검토 결과: ${VERDICT_LABELS[issue.claim.verdict]} (신뢰도 ${Math.round(issue.claim.confidence * 100)}%)`);
      for (const s of issue.claim.sources) {
        lines.push(`  - 출처: [${s.title}](${s.url})`);
      }
    }
    lines.push('');
  }
  lines.push('---');
  lines.push(`> ${SAFETY_NOTICE}`);
  return lines.join('\n');
}

export function toJson(detail: ProjectDetail, result: AnalysisResult): string {
  return JSON.stringify(
    {
      project: {
        id: detail.project.id,
        name: detail.project.name,
        description: detail.project.description,
      },
      score: result.score,
      summary: result.summary,
      checklist: result.checklist,
      issues: result.issues,
      duplicationPairs: result.duplicationPairs,
      generatedAt: result.generatedAt,
      notice: SAFETY_NOTICE,
    },
    null,
    2,
  );
}

export function toPrintableHtml(detail: ProjectDetail, result: AnalysisResult): string {
  const esc = (s: string) =>
    s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
  const issuesHtml = result.issues
    .map(
      (i) => `
    <div class="issue sev-${i.severity}">
      <div class="tags"><span class="tag">${CATEGORY_LABELS[i.category]}</span>
      <span class="tag">${scopeName(i)}</span>
      <span class="tag">심각도 ${SEVERITY_LABELS[i.severity]}</span></div>
      <p class="src">${esc(i.sourceText)}</p>
      ${i.suggestedText ? `<p class="sug">→ ${esc(i.suggestedText)}</p>` : ''}
      <p class="exp">${esc(i.explanation)}</p>
      ${
        i.claim
          ? `<p class="verdict">검토 결과: ${VERDICT_LABELS[i.claim.verdict]} (신뢰도 ${Math.round(i.claim.confidence * 100)}%)</p>` +
            i.claim.sources.map((s) => `<a href="${esc(s.url)}">${esc(s.title)}</a>`).join(' ')
          : ''
      }
    </div>`,
    )
    .join('');

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>검수 리포트 — ${esc(detail.project.name)}</title>
<style>
  body{font-family:system-ui,-apple-system,"Apple SD Gothic Neo",sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#0f172a;line-height:1.6;word-break:keep-all}
  h1{font-size:24px} .meta{color:#475569;font-size:14px}
  .score{font-size:40px;font-weight:800;color:#5b2ff0}
  .issue{border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin:12px 0}
  .sev-high{border-left:4px solid #e11d48} .sev-medium{border-left:4px solid #d97706} .sev-low{border-left:4px solid #64748b}
  .tag{display:inline-block;background:#f1f5f9;border-radius:999px;padding:2px 10px;font-size:12px;margin-right:6px}
  .src{font-weight:600;margin:8px 0 4px} .sug{color:#5b2ff0;margin:2px 0} .exp{color:#475569;font-size:14px;white-space:pre-line}
  .verdict{font-size:13px;color:#334155;margin-top:6px} a{color:#5b2ff0;font-size:13px}
  .notice{margin-top:24px;padding:12px;background:#fef9c3;border-radius:10px;font-size:13px}
  @media print{.no-print{display:none}}
</style></head><body>
<h1>업로드 전 검수 리포트</h1>
<p class="meta">${esc(detail.project.name)} · ${new Date(result.generatedAt).toLocaleString('ko-KR')}</p>
<p class="score">${result.score.overall}점 <span style="font-size:16px;color:#475569">/ ${SCORE_LABELS[result.score.label]}</span></p>
<p class="meta">총 이슈 ${result.summary.totalIssues}건 · 사실 검토 ${result.summary.claimCount}문장 · 중복 ${result.summary.duplicatePairCount}건</p>
<h2>체크리스트</h2>
<ul>${result.checklist.map((c) => `<li>${c.passed ? '✅' : '⬜️'} <b>${esc(c.label)}</b> — ${esc(c.detail)}</li>`).join('')}</ul>
<h2>발견된 이슈</h2>
${issuesHtml || '<p>발견된 이슈가 없습니다.</p>'}
<div class="notice">${esc(SAFETY_NOTICE)}</div>
<button class="no-print" onclick="window.print()" style="margin-top:20px;padding:10px 16px;border-radius:8px;border:0;background:#5b2ff0;color:#fff;cursor:pointer">인쇄 / PDF 저장</button>
</body></html>`;
}
