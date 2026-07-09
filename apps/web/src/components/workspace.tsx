'use client';

import { useCallbackRef } from '@/lib/use-callback-ref';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, RefreshCw, Trash2 } from 'lucide-react';
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
import { loadSheet, type SheetTable } from '@/lib/smcc-client';
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
  // 구글시트 연동(선택) — 신청 건(행)을 골라두면 그 시트 값을 기준(정답)으로 카드 전체를 검수한다.
  const [sheetType, setSheetType] = useState<smcc.SheetType | ''>('');
  const [sheetTable, setSheetTable] = useState<SheetTable>({ headers: [], rows: [] });
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetSource, setSheetSource] = useState<'live' | 'fixture' | null>(null);
  const [sheetMessage, setSheetMessage] = useState<string | undefined>();
  const [linkedRowIndex, setLinkedRowIndex] = useState<number | null>(null);

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

  async function loadSheetType(type: smcc.SheetType) {
    setSheetLoading(true);
    setLinkedRowIndex(null);
    const src = smcc.SHEET_SOURCES.find((s) => s.type === type)!;
    const { table, source, message } = await loadSheet(type, src.url);
    setSheetTable(table);
    setSheetSource(source);
    setSheetMessage(message);
    setSheetLoading(false);
  }

  function onSheetTypeChange(type: smcc.SheetType | '') {
    setSheetType(type);
    setLinkedRowIndex(null);
    setSheetTable({ headers: [], rows: [] });
    setSheetSource(null);
    setSheetMessage(undefined);
    if (type) void loadSheetType(type);
  }

  const sheetEvents: smcc.NormalizedEvent[] = useMemo(() => {
    if (!sheetType || sheetTable.rows.length === 0) return [];
    const src = smcc.SHEET_SOURCES.find((s) => s.type === sheetType)!;
    return smcc.normalizeSheet(sheetType, src.url, sheetTable.headers, sheetTable.rows);
  }, [sheetType, sheetTable]);

  const linkedEvent = linkedRowIndex != null ? sheetEvents[linkedRowIndex] : undefined;

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

  function buildInput(texts: Map<number, string>): AnalysisInput {
    return {
      slides: slides.map((s) => ({
        slideNumber: s.slideNumber,
        text: texts.get(s.slideNumber) ?? s.editedText ?? s.rawText,
        ocrConfidence: s.ocrConfidence ?? undefined,
      })),
      captionText: captionText.trim() ? captionText : undefined,
      factCheckEnabled: true,
    };
  }

  /**
   * 규칙 검수: 구글시트 행을 연동해뒀으면 그 행 값(정답)을 기준으로 카드 전체 텍스트를 비교 검수하고,
   * 연동하지 않았으면 카드 텍스트만 보고 추론하는 방식(standalone)으로 대체 검수한다.
   */
  function runRuleCheck(texts: Map<number, string>): DisplayIssue[] {
    if (linkedEvent) {
      const combined = [
        ...slides.map((s) => texts.get(s.slideNumber) ?? s.editedText ?? s.rawText),
        captionText,
      ]
        .filter((t) => t.trim())
        .join('\n');
      const { issues } = smcc.reviewEvent(linkedEvent, combined);
      return issues.map((i) => fromSmccIssue('구글시트 연동', i));
    }
    const out: DisplayIssue[] = [];
    for (const s of slides) {
      const text = texts.get(s.slideNumber) ?? s.editedText ?? s.rawText;
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

  /** 이미지 → 텍스트. 비전 AI(설정된 경우) 우선, 안 되면 로컬 OCR. 상태는 건드리지 않는 순수 함수. */
  async function extractTextForSlide(imageDataUrl: string): Promise<{ text: string; confidence: number } | null> {
    const visionText = await tryVisionExtract(imageDataUrl);
    if (visionText) return { text: visionText, confidence: 0.95 };
    return tryTesseractExtract(imageDataUrl);
  }

  async function onRun() {
    setError(null);
    if (slides.length === 0 && !captionText.trim()) {
      setError('이미지 또는 캡션을 먼저 입력하세요.');
      return;
    }
    setAnalyzing(true);
    setResolvedIds(new Set());
    try {
      // 1) 텍스트가 없는 슬라이드는 버튼 없이 자동으로 이미지에서 읽어온다.
      const finalTexts = new Map<number, string>();
      const needsExtract = slides.filter((s) => !(s.editedText ?? s.rawText).trim() && s.previewUrl);
      for (let i = 0; i < needsExtract.length; i++) {
        const s = needsExtract[i]!;
        setProgress({
          step: 'ocr',
          percent: Math.round(((i + 1) / needsExtract.length) * 20),
          message: `이미지에서 텍스트 읽는 중 (${i + 1}/${needsExtract.length})`,
        });
        const result = await extractTextForSlide(s.previewUrl!);
        if (result) {
          finalTexts.set(s.slideNumber, result.text);
          applySlideText(s.slideNumber, result.text, result.confidence);
        }
      }

      const input = buildInput(finalTexts);
      const analysisPromise = runAnalysis(input);
      for (const step of ANALYSIS_STEPS) {
        setProgress({ step: step.step, percent: step.percent, message: step.label });
        await sleep(150);
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
      setRuleIssues(runRuleCheck(finalTexts));
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

  // 왼쪽에서 고른 슬라이드의 결과만 보여준다. 캡션/전체/시트연동처럼 슬라이드 하나에 속하지
  // 않는 항목은 어떤 슬라이드를 골라도 항상 함께 보여준다.
  const currentScope = current ? `슬라이드 ${current.slideNumber}` : null;
  const scopedIssues = displayIssues.filter(
    (i) => !/^슬라이드 \d+$/.test(i.scope) || i.scope === currentScope,
  );

  return (
    <div className="container-page py-6">
      {/* 상단 바: 왼쪽부터 순서대로 — 구글시트 연동 → 검수 시작하기 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {/* 1. 구글시트 연동(선택): 신청 건을 골라두면 그 값을 기준(정답)으로 카드 전체를 비교 검수한다 */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50/50 px-4 py-3 text-sm">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
              1
            </span>
            <span className="font-semibold text-brand-800">구글시트 연동</span>
            <select
              value={sheetType}
              onChange={(e) => onSheetTypeChange(e.target.value as smcc.SheetType | '')}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none"
            >
              <option value="">연동 안 함</option>
              {smcc.SHEET_SOURCES.map((s) => (
                <option key={s.type} value={s.type}>
                  {s.label}
                </option>
              ))}
            </select>
            {sheetType && (
              <>
                <select
                  value={linkedRowIndex ?? ''}
                  onChange={(e) => setLinkedRowIndex(e.target.value === '' ? null : Number(e.target.value))}
                  disabled={sheetLoading || sheetEvents.length === 0}
                  className="max-w-[240px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none"
                >
                  <option value="">신청 건 선택</option>
                  {sheetEvents.map((ev, i) => (
                    <option key={i} value={i}>
                      {[ev.cafeName, ev.dateRaw, ev.hostInstagram].filter(Boolean).join(' · ') || `행 ${i + 1}`}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void loadSheetType(sheetType)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-slate-400 hover:bg-white"
                  title="다시 불러오기"
                >
                  <RefreshCw className={cn('h-4 w-4', sheetLoading && 'animate-spin')} />
                </button>
                {sheetSource && (
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[11px]',
                      sheetSource === 'live' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                    )}
                  >
                    {sheetSource === 'live' ? '실시간' : '예시'}
                  </span>
                )}
                {sheetMessage && <span className="text-xs text-slate-400">{sheetMessage}</span>}
              </>
            )}
            {linkedEvent && (
              <span className="font-medium text-brand-700">
                연동됨: {linkedEvent.cafeName} · {linkedEvent.languageLabelExpected}
              </span>
            )}
          </div>

          {/* 2. 검수 시작하기 */}
          <Button onClick={onRun} disabled={analyzing} size="lg">
            {analyzing && <Loader2 className="h-4 w-4 animate-spin" />}
            검수 시작하기
          </Button>
        </div>
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
                {current.ocrConfidence != null && current.ocrConfidence < 0.5 && (
                  <Badge tone="warning" className="mt-3">
                    OCR 신뢰도 낮음
                  </Badge>
                )}
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
                  {current && (
                    <p className="mb-2 text-xs font-medium text-slate-500">
                      슬라이드 {current.slideNumber} 검수 결과
                    </p>
                  )}
                  <ResultsPanel issues={scopedIssues} resolvedIds={resolvedIds} onToggle={toggleIssue} />
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
