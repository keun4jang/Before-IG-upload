'use client';

import { useCallbackRef } from '@/lib/use-callback-ref';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, ScanText, Trash2 } from 'lucide-react';
import {
  ANALYSIS_STEPS,
  createId,
  nowIso,
  runAnalysis,
  smcc,
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
import { fromGeneralIssue, fromSmccIssue, sortIssues, type DisplayIssue } from '@/lib/unify-issues';
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
 * 검수는 두 엔진을 함께 돌린다:
 * 1) 일반 검수(오타/띄어쓰기/중복/사실검토) — 슬라이드+캡션 전체
 * 2) 규칙 검수(언어표기·라벨·요금-지역·날짜/요일 등) — 슬라이드별 카드 텍스트
 * 결과는 하나의 목록으로 합쳐서 보여준다.
 */
export function Workspace({ initial }: { initial: ProjectDetail }) {
  const projectId = initial.project.id;
  const [detail, setDetail] = useState<ProjectDetail>(initial);
  const [selected, setSelected] = useState(1);
  const [run, setRun] = useState<AnalysisRun | null>(initial.latestRun);
  const [ruleIssues, setRuleIssues] = useState<DisplayIssue[]>([]);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState(
    initial.caption?.editedText ?? initial.caption?.originalText ?? '',
  );
  const [ocr, setOcr] = useState<{ slideNumber: number; running: boolean; error: string | null } | null>(
    null,
  );
  // OCR 로 텍스트가 갱신되면 uncontrolled textarea 를 강제로 다시 마운트시키기 위한 버전 값
  const [ocrVersion, setOcrVersion] = useState(0);

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

  const generalResult = run?.status === 'succeeded' ? run.result : undefined;
  const hasResult = generalResult != null;

  const displayIssues: DisplayIssue[] = useMemo(() => {
    if (!hasResult) return [];
    const general = generalResult!.issues.map(fromGeneralIssue);
    return sortIssues([...general, ...ruleIssues]);
  }, [hasResult, generalResult, ruleIssues]);

  const openIssues = displayIssues.filter((i) => !resolvedIds.has(i.id));
  const errorCount = openIssues.filter((i) => i.severity === 'error').length;
  const warnCount = openIssues.filter((i) => i.severity === 'warning').length;
  const infoCount = openIssues.filter((i) => i.severity === 'info').length;

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

  function runRuleCheck(): DisplayIssue[] {
    const out: DisplayIssue[] = [];
    for (const s of slides) {
      const text = s.editedText ?? s.rawText;
      if (!text.trim()) continue;
      const { issues } = smcc.analyzeStandaloneCard(text);
      for (const i of issues) out.push(fromSmccIssue(`슬라이드 ${s.slideNumber}`, i));
    }
    if (captionText.trim()) {
      const { issues } = smcc.analyzeStandaloneCard(captionText);
      for (const i of issues) out.push(fromSmccIssue('캡션', i));
    }
    return out;
  }

  async function onRun() {
    setError(null);
    const hasEmptySlideText = slides.some((s) => !(s.editedText ?? s.rawText).trim());
    if (slides.length === 0 && !captionText.trim()) {
      setError('이미지 또는 캡션을 먼저 입력하세요.');
      return;
    }
    if (hasEmptySlideText) {
      setError('텍스트가 비어 있는 슬라이드가 있어요. OCR 추출 또는 직접 입력 후 다시 시도하세요.');
      return;
    }
    setAnalyzing(true);
    setResolvedIds(new Set());
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
      setRuleIssues(runRuleCheck());
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

  /** 이미지를 직접 이해하는 비전 LLM 시도(설정된 경우). 미설정/실패 시 null. */
  async function tryVisionExtract(imageDataUrl: string): Promise<string | null> {
    try {
      const res = await fetch('/api/vision/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageDataUrl }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { available: boolean; text?: string };
      if (!data.available) return null;
      const text = (data.text ?? '').trim();
      return text || null;
    } catch {
      return null;
    }
  }

  /** 로컬 OCR(자체 호스팅, 키 불필요). 글자 단위 인식이라 장식 요소도 함께 뽑힐 수 있음. */
  async function tryTesseractExtract(imageDataUrl: string): Promise<{ text: string; confidence: number } | null> {
    try {
      const Tesseract = (await import('tesseract.js')).default;
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 45000),
      );
      const { data } = await Promise.race([
        Tesseract.recognize(imageDataUrl, 'kor+eng', {
          workerPath: '/tesseract/worker.min.js',
          corePath: '/tesseract/tesseract-core-lstm.wasm.js',
          langPath: '/tessdata',
        }),
        timeout,
      ]);
      const text = (data.text ?? '').trim();
      if (!text) return null;
      return { text, confidence: (data.confidence ?? 50) / 100 };
    } catch {
      return null;
    }
  }

  function applySlideText(slideNumber: number, text: string, confidence: number) {
    setDetail((d) => ({
      ...d,
      slides: d.slides.map((s) =>
        s.slideNumber === slideNumber
          ? { ...s, ocrRawText: text, ocrEditedText: text, ocrConfidence: confidence }
          : s,
      ),
    }));
    api.updateSlide(projectId, slideNumber, text).catch(() => {});
    setOcrVersion((v) => v + 1);
  }

  async function runOcr(slideNumber: number, imageDataUrl: string) {
    setOcr({ slideNumber, running: true, error: null });

    // 1순위: 이미지 자체를 이해하는 비전 AI (설정된 경우) — 장식 요소를 걸러내고 의미 있는 텍스트만 정리해 준다.
    const visionText = await tryVisionExtract(imageDataUrl);
    if (visionText) {
      applySlideText(slideNumber, visionText, 0.95);
      setOcr({ slideNumber, running: false, error: null });
      return;
    }

    // 2순위: 로컬 OCR (키 불필요, 항상 동작하는 기본값)
    const ocrResult = await tryTesseractExtract(imageDataUrl);
    if (ocrResult) {
      applySlideText(slideNumber, ocrResult.text, ocrResult.confidence);
      setOcr({ slideNumber, running: false, error: null });
      return;
    }

    setOcr({
      slideNumber,
      running: false,
      error: '텍스트를 찾지 못했어요. 직접 입력해 주세요.',
    });
  }

  function toggleIssue(issueId: string, resolved: boolean) {
    setResolvedIds((prev) => {
      const next = new Set(prev);
      if (resolved) next.add(issueId);
      else next.delete(issueId);
      return next;
    });
  }

  const current = slides.find((s) => s.slideNumber === selected) ?? slides[0];
  const statusLabel = errorCount > 0 ? '수정 필요' : warnCount > 0 ? '확인 권장' : '이상 없음';
  const statusTone = errorCount > 0 ? 'danger' : warnCount > 0 ? 'warning' : 'success';

  return (
    <div className="container-page py-6">
      {/* 상단 바 */}
      <div className="flex items-center justify-between gap-3">
        {hasResult ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone}>{statusLabel}</Badge>
            <span className="text-xs text-slate-400">
              오류 {errorCount} · 경고 {warnCount} · 확인 {infoCount}
            </span>
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
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* 3열 워크스페이스 */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[260px_1fr_360px]">
        {/* 좌: 슬라이드 리스트 */}
        <div className="space-y-3">
          <Uploader onAdd={addImages} remaining={20 - slides.length} disabled={analyzing} />
          <div className="space-y-2">
            {slides.map((s) => (
              <button
                key={s.assetId}
                onClick={() => setSelected(s.slideNumber)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-xl border p-2 text-left transition',
                  selected === s.slideNumber
                    ? 'border-brand-400 bg-brand-50/50'
                    : 'border-slate-200 hover:border-slate-300',
                )}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                  {s.previewUrl ? (                    <img src={s.previewUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-slate-400">{s.slideNumber}</span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-slate-500">
                    {(s.editedText ?? s.rawText).slice(0, 24) || `슬라이드 ${s.slideNumber}`}
                  </span>
                </span>
              </button>
            ))}
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
                    className="mt-1 w-full rounded-xl border border-slate-200 object-contain"
                    style={{ maxHeight: 340 }}
                  />
                )}
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between">
                    {current.ocrConfidence != null && current.ocrConfidence < 0.5 ? (
                      <Badge tone="warning">OCR 신뢰도 낮음</Badge>
                    ) : (
                      <span />
                    )}
                    {current.previewUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runOcr(current.slideNumber, current.previewUrl!)}
                        disabled={ocr?.slideNumber === current.slideNumber && ocr.running}
                      >
                        {ocr?.slideNumber === current.slideNumber && ocr.running ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ScanText className="h-3.5 w-3.5" />
                        )}
                        이미지에서 추출
                      </Button>
                    )}
                  </div>
                  {ocr?.slideNumber === current.slideNumber && ocr.error && (
                    <p className="mb-1 text-xs text-rose-600">{ocr.error}</p>
                  )}
                  <textarea
                    key={`${current.slideNumber}-${ocrVersion}`}
                    defaultValue={current.editedText ?? current.rawText}
                    onBlur={(e) => saveSlideText(current.slideNumber, e.target.value)}
                    placeholder="이미지 속 텍스트를 입력하거나 붙여넣으세요."
                    className="min-h-[120px] w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
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
                className="min-h-[110px] w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
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
              ) : hasResult ? (
                <div className="flex h-[70vh] flex-col">
                  <ResultsPanel issues={displayIssues} resolvedIds={resolvedIds} onToggle={toggleIssue} />
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
