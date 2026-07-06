/**
 * 데모 데이터 시드. `pnpm db:seed` 로 실행.
 * (DEMO_MODE 에서는 필요 없습니다 — in-memory 저장소가 자동 시드됩니다.)
 */
import {
  DEMO_CAPTION,
  DEMO_META,
  DEMO_SLIDES,
  makePlaceholderImage,
  runAnalysis,
} from '@big/shared';
import { getPrisma } from '../src/index.js';

async function main() {
  const prisma = await getPrisma();
  console.log('🌱 데모 프로젝트 시드 시작...');

  // 기존 데모 프로젝트 정리
  await prisma.project.deleteMany({ where: { name: DEMO_META.name } });

  const project = await prisma.project.create({
    data: {
      name: DEMO_META.name,
      description: DEMO_META.description,
      notes: DEMO_META.notes,
      status: 'analyzed',
    },
  });

  for (const slide of DEMO_SLIDES) {
    const asset = await prisma.asset.create({
      data: {
        projectId: project.id,
        fileName: `slide-${slide.slideNumber}.svg`,
        mimeType: 'image/svg+xml',
        storageKey: `demo/${project.id}/slide-${slide.slideNumber}.svg`,
        previewUrl: makePlaceholderImage(slide.slideNumber, slide.title),
        sortOrder: slide.slideNumber - 1,
        width: 1080,
        height: 1080,
      },
    });
    await prisma.slide.create({
      data: {
        projectId: project.id,
        assetId: asset.id,
        slideNumber: slide.slideNumber,
        ocrRawText: slide.text,
        ocrConfidence: 0.9,
      },
    });
  }

  await prisma.captionDraft.create({
    data: { projectId: project.id, originalText: DEMO_CAPTION },
  });

  // 분석 실행 결과 저장
  const result = await runAnalysis({
    slides: DEMO_SLIDES.map((s) => ({ slideNumber: s.slideNumber, text: s.text })),
    captionText: DEMO_CAPTION,
    factCheckEnabled: true,
  });

  const run = await prisma.analysisRun.create({
    data: {
      projectId: project.id,
      status: 'succeeded',
      startedAt: new Date(),
      finishedAt: new Date(),
      overallScore: result.score.overall,
      summaryJson: result.summary as any,
      resultJson: result as any,
    },
  });

  for (const issue of result.issues) {
    const created = await prisma.issue.create({
      data: {
        analysisRunId: run.id,
        scopeType: issue.scopeType,
        scopeRefId: issue.scopeRefId,
        category: issue.category,
        severity: issue.severity,
        confidence: issue.confidence,
        sourceText: issue.sourceText,
        suggestedText: issue.suggestedText ?? null,
        explanation: issue.explanation,
        locationJson: (issue.location ?? null) as any,
        isResolved: issue.isResolved,
      },
    });
    if (issue.claim) {
      await prisma.claimCheck.create({
        data: {
          issueId: created.id,
          claimText: issue.claim.claimText,
          domain: issue.claim.domain,
          highRisk: issue.claim.highRisk,
          verdict: issue.claim.verdict,
          rationale: issue.claim.rationale,
          confidence: issue.claim.confidence,
          checkedAt: new Date(issue.claim.checkedAt),
          sources: {
            create: issue.claim.sources.map((s) => ({
              title: s.title,
              url: s.url,
              snippet: s.snippet,
              sourceType: s.sourceType ?? null,
            })),
          },
        },
      });
    }
  }

  console.log(`✅ 시드 완료: 프로젝트 "${project.name}" (점수 ${result.score.overall})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
