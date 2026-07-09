'use client';

import { useCallbackRef } from '@/lib/use-callback-ref';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, Trash2 } from 'lucide-react';
import {
  ANALYSIS_STEPS,
  createId,
  nowIso,
  runAnalysis,
  type AnalysisInput,
  type AnalysisProgress,
  type AnalysisResult,
  type AnalysisRun,
  type Asset,
  type Slide,
} from '@big/shared';
import { Badge, Button, Card, CardContent, cn } from '@big/ui';
import type { ProjectDetail } from '@/lib/store/types';
import { api } from '@/lib/api-client';
import { saveLocalProjectDetail } from '@/lib/local-projects';
import { ScoreRing } from './score-ring';
import { Uploader, type PreparedImage } from './uploader';
import { AnalysisProgressView } from './analysis-progress';
import { ResultsPanel } from './results-panel';

interface SlideVM {
  slideNumber: number;
  assetId: string;
  previewUrl?: string;
  rawText: string;
  editedText: string | null;
  ocrConfidence: number | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 검수 엔진은 순수 TS 라 브라우저에서 그대로 실행됩니다.
 * 서버리스(Vercel) 환경에서도 100% 안정적으로 동작하도록 분석을 클라이언트에서 수행하고,
 * 서버 저장은 "best-effort"(실패해도 UI 는 동작)로만 시도합니다.
 */
export function Workspace({ initial }: { initial: ProjectDetail }) {
  const projectId = initial.project.id;
  const [detail, setDetail] = useState<ProjectDetail>(initial);
  const [selected, setSelected] = useState(1);
  const [run, setRun] = useState<AnalysisRun | null>(initial.latestRun);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState(
    initial.caption?.editedText ?? initial.caption?.originalText ?? '',
  );

  // 브라우저에 프로젝트 상태를 자동 저장 (재방문/새로고침 시 유지, 서버 메모리에 의존하지 않음)
  useEffect(() => {
    saveLocalProjectDetail({
      ...detail,
      caption: detail.caption
        ? { ...detail.caption, editedText: captionText }
        : { id: createId('cap'), projectId, originalText: captionText, editedText: captionText },
      latestRun: run,
      runs: run ? [run, ...detail.runs.filter((r) => r.id !== run.id)] : detail.runs,
    });
  }, [detail, run, captionText, projectId]);

  const slides: SlideVM[] = useMemo(() => {
    return detail.slides
      .slice()
      .sort((a, b) => a.slideNumber - b.slideNumber)
      .map((s) => {
        const asset = detail.assets.find((a) => a.id === s.assetId);
        return {
          slideNumber: s.slideNumber,
          assetId: s.assetId,
          previewUrl: asset?.previewUrl,
          rawText: s.ocrRawText,
          editedText: s.ocrEditedText,
          ocrConfidence: s.ocrConfidence,
        };
      });
  }, [detail]);

  const result = run?.status === 'succeeded' ? run.result : undefined;

  function buildInput(): AnalysisInput {
    return {
      slides: slides.map((s) => ({
        slideNumber: s.slideNumber,
        text: s.editedText ?? s.rawText,
        ocrConfidence: s.ocrConfidence ?? undefined,
      })),
      captionText: captionText.trim() ? captionText : undefined,
      factCheckEnabled: true,
    };
  }

  async function onRun() {
    setError(null);
    if (slides.length === 0 && !captionText.trim()) {
      setError('이미지 또는 캡션을 먼저 입력하세요.');
      return;
    }
    setAnalyzing(true);
    const input = buildInput();
    try {
      const analysisPromise = runAnalysis(input);
      for (const step of ANALYSIS_STEPS) {
        setProgress({ step: step.step, percent: step.percent, message: step.label });
        await sleep(200);
      }
      const analysisResult: AnalysisResult = await analysisPromise;
      const finished = nowIso();
      setRun({
        id: createId('run'),
        projectId,
        status: 'succeeded',
        startedAt: finished,
        finishedAt: finished,
        overallScore: analysisResult.score.overall,
        result: analysisResult,
        progress: { step: 'finalize', percent: 100, message: '완료' },
      });
      api.runAnalysis(projectId).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : '검수 중 문제가 발생했어요.');
    } finally {
      setAnalyzing(false);
      setProgress(undefined);
    }
  }

  function addImages(images: PreparedImage[]) {
    const startOrder = detail.assets.length;
    const startSlide = detail.slides.length;
    const newAssets: Asset[] = images.map((img, i) => ({
      id: createId('ast'),
      projectId,
      fileName: img.fileName,
      mimeType: img.mimeType,
      storageKey: `mem/${i}`,
      previewUrl: img.previewUrl,
      width: img.width,
      height: img.height,
      sizeBytes: img.sizeBytes,
      sortOrder: startOrder + i,
    }));
    const newSlides: Slide[] = newAssets.map((a, i) => ({
      id: createId('sld'),
      projectId,
      assetId: a.id,
      slideNumber: startSlide + i + 1,
      ocrRawText: '',
      ocrEditedText: null,
      ocrConfidence: null,
      textBlocks: [],
    }));
    setDetail((d) => ({ ...d, assets: [...d.assets, ...newAssets], slides: [...d.slides, ...newSlides] }));
    setSelected(startSlide + 1);
    api.addAssets(projectId, images.map((i) => ({ ...i }))).catch(() => {});
    return Promise.resolve();
  }

  function removeSlide(assetId: string) {
    setDetail((d) => {
      const assets = d.assets.filter((a) => a.id !== assetId).map((a, i) => ({ ...a, sortOrder: i }));
      const slides = d.slides
        .filter((s) => s.assetId !== assetId)
        .sort((a, b) => a.slideNumber - b.slideNumber)
        .map((s, i) => ({ ...s, slideNumber: i + 1 }));
      return { ...d, assets, slides };
    });
    setSelected((s) => Math.max(1, s - 1));
    api.removeAsset(projectId, assetId).catch(() => {});
  }

  function move(assetId: string, dir: -1 | 1) {
    const ordered = slides.map((s) => s.assetId);
    const idx = ordered.indexOf(assetId);
    const next = idx + dir;
    if (next < 0 || next >= ordered.length) return;
    [ordered[idx], ordered[next]] = [ordered[next]!, ordered[idx]!];
    setDetail((d) => {
      const rank = new Map(ordered.map((id, i) => [id, i]));
      const assets = d.assets
        .slice()
        .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
        .map((a, i) => ({ ...a, sortOrder: i }));
      const slideByAsset = new Map(d.slides.map((s) => [s.assetId, s]));
      const slides = ordered.map((id, i) => ({ ...slideByAsset.get(id)!, slideNumber: i + 1 }));
      return { ...d, assets, slides };
    });
    api.reorder(projectId, ordered).catch(() => {});
  }

  const saveSlideText = useCallbackRef((slideNumber: number, text: string) => {
    setDetail((d) => ({
      ...d,
      slides: d.slides.map((s) => (s.slideNumber === slideNumber ? { ...s, ocrEditedText: text } : s)),
    }));
    api.updateSlide(projectId, slideNumber, text).catch(() => {});
  });

  const saveCaption = useCallbackRef((text: string) => {
    api.updateCaption(projectId, { editedText: text }).catch(() => {});
  });

  function toggleIssue(issueId: string, resolved: boolean) {
    setRun((r) => {
      if (!r?.result) return r;
      const issues = r.result.issues.map((i) => (i.id === issueId ? { ...i, isResolved: resolved } : i));
      return { ...r, result: { ...r.result, issues } };
    });
  }

  const current = slides.find((s) => s.slideNumber === selected) ?? slides[0];

  return (
    <div className="container-page py-6">
      {/* 상단 바 */}
      <div className="flex items-center justify-between gap-3">
        {result ? (
          <div className="flex items-center gap-3">
            <ScoreRing score={result.score.overall} size={64} />
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="danger">높음 {result.summary.bySeverity.high}</Badge>
              <Badge tone="warning">중간 {result.summary.bySeverity.medium}</Badge>
              <Badge tone="neutral">낮음 {result.summary.bySeverity.low}</Badge>
            </div>
          </div>
        ) : (
          <span />
        )}
        <Button onClick={onRun} disabled={analyzing}>
          {analyzing && <Loader2 className="h-4 w-4 animate-spin" />}
          검수 시작하기
        </Button>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* 3열 워크스페이스 */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[260px_1fr_360px]">
        {/* 좌: 슬라이드 리스트 */}
        <div className="space-y-3">
          <Uploader onAdd={addImages} remaining={20 - slides.length} disabled={analyzing} />
          <div className="space-y-2">
            {slides.map((s) => {
              const sc = result?.score.perSlide.find((p) => p.slideNumber === s.slideNumber);
              return (
                <button
                  key={s.assetId}
                  onClick={() => setSelected(s.slideNumber)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-xl border p-2 text-left transition',
                    selected === s.slideNumber
                      ? 'border-brand-400 bg-brand-50/50 dark:bg-brand-950/30'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-800',
                  )}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                    {s.previewUrl ? (                      <img src={s.previewUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs text-slate-400">{s.slideNumber}</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-slate-500">
                      {(s.editedText ?? s.rawText).slice(0, 24) || `슬라이드 ${s.slideNumber}`}
                    </span>
                  </span>
                  {sc && <span className="text-xs font-semibold text-slate-400">{sc.score}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* 중앙: 미리보기 + 텍스트 편집 + 캡션 */}
        <div className="space-y-4">
          {current && (
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => move(current.assetId, -1)}>
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => move(current.assetId, 1)}>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSlide(current.assetId)}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {current.previewUrl && (                  <img
                    src={current.previewUrl}
                    alt={`슬라이드 ${current.slideNumber}`}
                    className="mt-1 w-full rounded-xl border border-slate-200 object-contain dark:border-slate-800"
                    style={{ maxHeight: 340 }}
                  />
                )}
                <div className="mt-4">
                  {current.ocrConfidence != null && current.ocrConfidence < 0.5 && (
                    <Badge tone="warning" className="mb-1">
                      OCR 신뢰도 낮음
                    </Badge>
                  )}
                  <textarea
                    key={current.slideNumber}
                    defaultValue={current.editedText ?? current.rawText}
                    onBlur={(e) => saveSlideText(current.slideNumber, e.target.value)}
                    placeholder="이미지 속 텍스트를 입력하거나 붙여넣으세요."
                    className="min-h-[120px] w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-brand-950"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* 캡션 */}
          <Card>
            <CardContent className="pt-5">
              <textarea
                value={captionText}
                onChange={(e) => setCaptionText(e.target.value)}
                onBlur={(e) => saveCaption(e.target.value)}
                placeholder="캡션을 입력하거나 붙여넣으세요."
                className="min-h-[110px] w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-brand-950"
              />
            </CardContent>
          </Card>
        </div>

        {/* 우: 결과 */}
        <div>
          <Card className="lg:sticky lg:top-20">
            <CardContent className="pt-5">
              {analyzing ? (
                <AnalysisProgressView progress={progress} />
              ) : result ? (
                <div className="flex h-[70vh] flex-col">
                  <ResultsPanel result={result} onToggle={toggleIssue} />
                </div>
              ) : (
                <p className="py-16 text-center text-sm text-slate-400">
                  이미지와 캡션을 넣고 검수를 시작하세요.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
