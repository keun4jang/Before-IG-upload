'use client';

import { useCallbackRef } from '@/lib/use-callback-ref';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  FileJson,
  FileText,
  Play,
  Printer,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { AnalysisRun } from '@big/shared';
import { Badge, Button, Card, CardContent, cn } from '@big/ui';
import type { ProjectDetail } from '@/lib/store/types';
import { api } from '@/lib/api-client';
import { ScoreRing } from './score-ring';
import { Uploader, type PreparedImage } from './uploader';
import { AnalysisProgressView } from './analysis-progress';
import { ResultsPanel } from './results-panel';
import { Checklist } from './checklist';
import { SafetyNotice } from './safety-notice';

interface SlideVM {
  slideNumber: number;
  assetId: string;
  previewUrl?: string;
  rawText: string;
  editedText: string | null;
  ocrConfidence: number | null;
}

export function Workspace({ initial }: { initial: ProjectDetail }) {
  const projectId = initial.project.id;
  const [detail, setDetail] = useState<ProjectDetail>(initial);
  const [selected, setSelected] = useState(1);
  const [run, setRun] = useState<AnalysisRun | null>(initial.latestRun);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState(
    initial.caption?.editedText ?? initial.caption?.originalText ?? '',
  );

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

  async function reload() {
    const fresh = await api.getProject(projectId);
    setDetail(fresh);
  }

  // 분석 폴링
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };
  useEffect(() => stopPolling, []);

  async function onRun() {
    setError(null);
    setAnalyzing(true);
    try {
      const { run: started } = await api.runAnalysis(projectId);
      setRun(started);
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const { run: latest } = await api.getRun(started.id);
          setRun(latest);
          if (latest.status === 'succeeded' || latest.status === 'failed') {
            stopPolling();
            setAnalyzing(false);
            if (latest.status === 'failed') setError(latest.error ?? '분석에 실패했어요.');
            void reload();
          }
        } catch {
          /* 폴링 오류는 다음 틱에서 재시도 */
        }
      }, 500);
    } catch (err) {
      setAnalyzing(false);
      setError(err instanceof Error ? err.message : '분석을 시작하지 못했어요.');
    }
  }

  async function addImages(images: PreparedImage[]) {
    await api.addAssets(
      projectId,
      images.map((i) => ({
        fileName: i.fileName,
        mimeType: i.mimeType,
        previewUrl: i.previewUrl,
        width: i.width,
        height: i.height,
        sizeBytes: i.sizeBytes,
      })),
    );
    await reload();
  }

  async function removeSlide(assetId: string) {
    if (!confirm('이 슬라이드를 삭제할까요?')) return;
    await api.removeAsset(projectId, assetId);
    await reload();
    setSelected((s) => Math.max(1, Math.min(s, slides.length - 1)));
  }

  async function move(assetId: string, dir: -1 | 1) {
    const ordered = slides.map((s) => s.assetId);
    const idx = ordered.indexOf(assetId);
    const next = idx + dir;
    if (next < 0 || next >= ordered.length) return;
    [ordered[idx], ordered[next]] = [ordered[next]!, ordered[idx]!];
    await api.reorder(projectId, ordered);
    await reload();
  }

  const saveSlideText = useCallbackRef(async (slideNumber: number, text: string) => {
    await api.updateSlide(projectId, slideNumber, text);
    setDetail((d) => ({
      ...d,
      slides: d.slides.map((s) =>
        s.slideNumber === slideNumber ? { ...s, ocrEditedText: text } : s,
      ),
    }));
  });

  const saveCaption = useCallbackRef(async (text: string) => {
    await api.updateCaption(projectId, { editedText: text });
  });

  const current = slides.find((s) => s.slideNumber === selected) ?? slides[0];
  const perSlideScore = result?.score.perSlide.find((p) => p.slideNumber === current?.slideNumber);

  return (
    <div className="container-page py-6">
      {/* 상단 요약 바 */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <Link href="/dashboard" className="text-xs text-slate-400 hover:text-brand-600">
            ← 대시보드
          </Link>
          <h1 className="mt-1 truncate text-xl font-bold tracking-tight sm:text-2xl">
            {detail.project.name}
          </h1>
          {detail.project.description && (
            <p className="mt-0.5 truncate text-sm text-slate-500">{detail.project.description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {result && <ExportMenu projectId={projectId} />}
          <Button onClick={onRun} disabled={analyzing || slides.length === 0}>
            {result ? <RefreshCw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {result ? '다시 검수' : '검수 시작'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* 결과 요약 카드 */}
      {result && (
        <Card className="mt-4">
          <CardContent className="grid gap-5 pt-5 sm:grid-cols-[auto_1fr_1.2fr]">
            <div className="flex items-center justify-center">
              <ScoreRing score={result.score.overall} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">검수 요약</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="danger">높음 {result.summary.bySeverity.high}</Badge>
                <Badge tone="warning">중간 {result.summary.bySeverity.medium}</Badge>
                <Badge tone="neutral">낮음 {result.summary.bySeverity.low}</Badge>
              </div>
              <p className="text-xs text-slate-500">
                총 {result.summary.totalIssues}건 · 사실 검토 {result.summary.claimCount}문장 · 중복{' '}
                {result.summary.duplicatePairCount}건
              </p>
              {run?.finishedAt && (
                <p className="text-xs text-slate-400">
                  마지막 분석 {new Date(run.finishedAt).toLocaleString('ko-KR')}
                </p>
              )}
            </div>
            <div className="border-t border-slate-100 pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0 dark:border-slate-800">
              <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                업로드 전 체크리스트
              </p>
              <Checklist items={result.checklist} />
            </div>
          </CardContent>
        </Card>
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
                    <span className="block text-xs font-medium">슬라이드 {s.slideNumber}</span>
                    <span className="block truncate text-xs text-slate-400">
                      {(s.editedText ?? s.rawText).slice(0, 20) || '텍스트 없음'}
                    </span>
                  </span>
                  {sc && (
                    <span className="text-xs font-semibold text-slate-400">{sc.score}</span>
                  )}
                </button>
              );
            })}
            {slides.length === 0 && (
              <p className="rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-400 dark:bg-slate-900">
                이미지를 올리면 슬라이드가 여기에 표시돼요.
              </p>
            )}
          </div>
        </div>

        {/* 중앙: 미리보기 + 텍스트 편집 + 캡션 */}
        <div className="space-y-4">
          {current ? (
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">슬라이드 {current.slideNumber}</p>
                  <div className="flex items-center gap-1">
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
                </div>
                {current.previewUrl && (                  <img
                    src={current.previewUrl}
                    alt={`슬라이드 ${current.slideNumber}`}
                    className="mt-3 w-full rounded-xl border border-slate-200 object-contain dark:border-slate-800"
                    style={{ maxHeight: 340 }}
                  />
                )}
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-500">
                      OCR / 텍스트 (직접 수정 가능)
                    </label>
                    {current.ocrConfidence != null && current.ocrConfidence < 0.5 && (
                      <Badge tone="warning">OCR 신뢰도 낮음</Badge>
                    )}
                  </div>
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
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-sm text-slate-400">
                왼쪽에서 이미지를 업로드해 시작하세요.
              </CardContent>
            </Card>
          )}

          {/* 캡션 */}
          <Card>
            <CardContent className="pt-5">
              <label className="text-sm font-semibold">캡션</label>
              <p className="mb-2 text-xs text-slate-400">본문에 넣을 캡션도 함께 검수합니다.</p>
              <textarea
                defaultValue={captionText}
                onChange={(e) => setCaptionText(e.target.value)}
                onBlur={(e) => saveCaption(e.target.value)}
                placeholder="캡션과 해시태그를 붙여넣으세요."
                className="min-h-[110px] w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-brand-950"
              />
            </CardContent>
          </Card>
        </div>

        {/* 우: 결과/진행 패널 */}
        <div>
          <Card className="lg:sticky lg:top-20">
            <CardContent className="pt-5">
              {analyzing || run?.status === 'running' || run?.status === 'queued' ? (
                <AnalysisProgressView progress={run?.progress} />
              ) : result ? (
                <div className="flex h-[70vh] flex-col">
                  <ResultsPanel runId={run!.id} result={result} onRunUpdated={setRun} />
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Sparkles className="mx-auto h-9 w-9 text-brand-400" />
                  <p className="mt-3 font-medium">검수를 시작해보세요</p>
                  <p className="mt-1 text-xs text-slate-400">
                    슬라이드 텍스트와 캡션을 확인한 뒤 “검수 시작”을 누르면 분석이 시작됩니다.
                  </p>
                  <Button className="mt-4" onClick={onRun} disabled={slides.length === 0}>
                    <Play className="h-4 w-4" /> 검수 시작
                  </Button>
                  <SafetyNotice className="mt-5 text-left" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      {perSlideScore && null}
    </div>
  );
}

function ExportMenu({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const base = `/api/reports/${projectId}/export`;
  return (
    <div className="relative">
      <Button variant="outline" onClick={() => setOpen((o) => !o)}>
        <Download className="h-4 w-4" /> 내보내기
      </Button>
      {open && (
        <>
          <button className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <a href={`${base}?format=md`} className={menuItem}>
              <FileText className="h-4 w-4" /> Markdown
            </a>
            <a href={`${base}?format=json`} className={menuItem}>
              <FileJson className="h-4 w-4" /> JSON
            </a>
            <a href={`${base}?format=print`} target="_blank" rel="noreferrer" className={menuItem}>
              <Printer className="h-4 w-4" /> 인쇄용 리포트
            </a>
          </div>
        </>
      )}
    </div>
  );
}

const menuItem =
  'flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800';
