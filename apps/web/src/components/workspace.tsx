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
import { loadSheet, type SheetTab } from '@/lib/smcc-client';
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
  // 구글시트 연동(선택) — 이미지(슬라이드)마다 서로 다른 신청 건일 수 있어서, 연동은
  // 슬라이드별로 따로 저장한다. 상단의 프로그램 선택은 "지금 어느 시트를 보고 있는지"이고,
  // 실제 연동은 슬라이드 하나하나에 걸린다.
  const [browsingSheetType, setBrowsingSheetType] = useState<smcc.SheetType | ''>('');
  const [sheetCache, setSheetCache] = useState<
    Partial<Record<smcc.SheetType, { tabs: SheetTab[]; source: 'live' | 'fixture' | null; message?: string; loading: boolean }>>
  >({});
  const [slideLinks, setSlideLinks] = useState<Record<number, { sheetType: smcc.SheetType; rowIndex: number }>>({});

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

  async function ensureSheetLoaded(type: smcc.SheetType, force = false) {
    if (!force && sheetCache[type]) return;
    setSheetCache((prev) => ({ ...prev, [type]: { tabs: prev[type]?.tabs ?? [], source: prev[type]?.source ?? null, message: prev[type]?.message, loading: true } }));
    const src = smcc.SHEET_SOURCES.find((s) => s.type === type)!;
    const { tabs, source, message } = await loadSheet(type, src.url);
    setSheetCache((prev) => ({ ...prev, [type]: { tabs, source, message, loading: false } }));
  }

  function onSheetTypeChange(type: smcc.SheetType | '') {
    setBrowsingSheetType(type);
    if (type) void ensureSheetLoaded(type);
  }

  // 탭마다 열 구성이 달라도(원본 응답 탭 vs 캡션 작성용 탭 등) 각 탭을 자기 헤더 기준으로
  // 정규화한 뒤 합친다 — 하나의 표로 강제로 합치면 열 개수가 다른 탭의 데이터가 통째로 빠진다.
  const eventsByType = useMemo(() => {
    const out: Partial<Record<smcc.SheetType, smcc.NormalizedEvent[]>> = {};
    for (const type of Object.keys(sheetCache) as smcc.SheetType[]) {
      const data = sheetCache[type];
      if (!data || data.tabs.length === 0) continue;
      const src = smcc.SHEET_SOURCES.find((s) => s.type === type)!;
      // tabTitles 가 지정된 소스(통합본 등)는 정답 탭만 사용한다. 제목이 빈 탭은 시트 API 키
      // 없이 단일 gid 로 받아온 경우라 그대로 통과시킨다.
      const usableTabs = data.tabs.filter(
        (tab) => !src.tabTitles || !tab.title || src.tabTitles.includes(tab.title),
      );
      const events = usableTabs.flatMap((tab) => smcc.normalizeSheet(type, src.url, tab.headers, tab.rows));
      // 최신 날짜가 맨 위로 오도록 정렬. 날짜를 해석 못 한 행은 항상 맨 뒤로 보낸다.
      out[type] = events.slice().sort((a, b) => {
        if (!a.dateIso && !b.dateIso) return 0;
        if (!a.dateIso) return 1;
        if (!b.dateIso) return -1;
        return b.dateIso.localeCompare(a.dateIso);
      });
    }
    return out;
  }, [sheetCache]);

  const browsingEvents = browsingSheetType ? (eventsByType[browsingSheetType] ?? []) : [];
  const browsingData = browsingSheetType ? sheetCache[browsingSheetType] : undefined;

  function resolveLinkedEvent(
    link: { sheetType: smcc.SheetType; rowIndex: number } | undefined,
  ): smcc.NormalizedEvent | undefined {
    if (!link) return undefined;
    return eventsByType[link.sheetType]?.[link.rowIndex];
  }

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
        text: stripWeekdayRow(texts.get(s.slideNumber) ?? s.editedText ?? s.rawText),
        ocrConfidence: s.ocrConfidence ?? undefined,
      })),
      captionText: captionText.trim() ? captionText : undefined,
      factCheckEnabled: true,
    };
  }

  /**
   * 규칙 검수: 슬라이드마다 구글시트 행이 연동돼 있으면 그 행 값(정답)을 기준으로 그 슬라이드
   * 카드 텍스트를 비교 검수하고, 연동하지 않은 슬라이드는 카드 텍스트만 보고 추론하는 방식
   * (standalone)으로 대체 검수한다. 이미지마다 다른 신청 건일 수 있어서 슬라이드 단위로 나눈다.
   */
  function runRuleCheck(
    texts: Map<number, string>,
    weekdayButtons: Map<number, { scan: smcc.WeekdayButtonScan; weekdayButton: number | null }>,
  ): DisplayIssue[] {
    const out: DisplayIssue[] = [];
    for (const s of slides) {
      const text = texts.get(s.slideNumber) ?? s.editedText ?? s.rawText;
      const btn = weekdayButtons.get(s.slideNumber);
      // 카드 텍스트가 비어도 요일 버튼 오타는 검사할 수 있으므로 btn 이 있으면 진행한다.
      if (!text.trim() && !btn) continue;
      const opts = { weekdayButtons: btn?.scan, weekdayButton: btn?.weekdayButton ?? null };
      const linkedEv = resolveLinkedEvent(slideLinks[s.slideNumber]);
      if (linkedEv) {
        const { issues } = smcc.reviewEvent(linkedEv, text, opts);
        for (const i of issues) out.push(fromSmccIssue(`슬라이드 ${s.slideNumber}`, i));
      } else {
        const { issues } = smcc.analyzeStandaloneCard(text, opts);
        for (const i of issues) out.push(fromSmccIssue(`슬라이드 ${s.slideNumber}`, i));
      }
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
    const result = await tryTesseractExtract(imageDataUrl);
    if (!result) return null;
    return { ...result, text: cleanOcrText(result.text) };
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

      // 2) 상단 요일 버튼 검사: 비전 AI가 켜져 있으면 그 결과("요일버튼:"/"선택요일:" 줄)를
      //    쓰고, 없으면 버튼 영역만 따로 잘라 로컬 OCR + 픽셀로 강조 버튼을 감지한다.
      const weekdayButtons = new Map<number, { scan: smcc.WeekdayButtonScan; weekdayButton: number | null }>();
      const withImage = slides.filter((s) => s.previewUrl);
      for (let i = 0; i < withImage.length; i++) {
        const s = withImage[i]!;
        setProgress({
          step: 'ocr',
          percent: 20 + Math.round(((i + 1) / withImage.length) * 5),
          message: `요일 버튼 확인 중 (${i + 1}/${withImage.length})`,
        });
        const slideText = finalTexts.get(s.slideNumber) ?? s.editedText ?? s.rawText;
        const result = parseVisionWeekday(slideText) ?? (await extractWeekdayButtons(s.previewUrl!));
        const hasScan =
          (result.scan.cells && result.scan.cells.length > 0) ||
          (result.scan.tokens && result.scan.tokens.length > 0);
        if (hasScan || result.weekdayButton != null) {
          weekdayButtons.set(s.slideNumber, result);
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
      setRuleIssues(runRuleCheck(finalTexts, weekdayButtons));
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

  /**
   * 로컬 OCR(자체 호스팅, 키 불필요). 글자 단위 인식이라 장식 요소도 함께 뽑힐 수 있음.
   * SMCC 카드처럼 아이콘·라벨·값이 흩어져 있는 레이아웃은 기본(완전 자동) 레이아웃 분석보다
   * "성긴 텍스트"(PSM 11) 모드가 실측상 더 정확해서 그 모드로 고정한다.
   */
  async function tryTesseractExtract(imageDataUrl: string): Promise<{ text: string; confidence: number } | null> {
    try {
      const { createWorker, PSM } = await import('tesseract.js');
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 45000),
      );
      const recognizePromise = (async () => {
        const worker = await createWorker('kor+eng', 1, {
          workerPath: '/tesseract/worker.min.js',
          corePath: '/tesseract/tesseract-core-lstm.wasm.js',
          langPath: '/tessdata',
        });
        try {
          await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: '1' });
          return await worker.recognize(imageDataUrl);
        } finally {
          await worker.terminate();
        }
      })();
      const { data } = await Promise.race([recognizePromise, timeout]);
      const text = (data.text ?? '').trim();
      if (!text) return null;
      return { text, confidence: (data.confidence ?? 50) / 100 };
    } catch {
      return null;
    }
  }

  /**
   * 비전 AI 결과 텍스트에 있는 "요일버튼: ..." / "선택요일: ..." 줄을 파싱해 요일 버튼 스캔으로
   * 변환한다. 비전 AI는 버튼 줄을 로컬 OCR보다 훨씬 정확히(오타·중복 포함) 읽어준다.
   * 해당 줄이 없으면 null → 호출부가 로컬 OCR(extractWeekdayButtons)로 대체.
   */
  function parseVisionWeekday(
    text: string,
  ): { scan: smcc.WeekdayButtonScan; weekdayButton: number | null } | null {
    const line = text.match(/요일\s*버튼\s*[:：]\s*([^\n]+)/);
    if (!line) return null;
    const tokens = (line[1]!.match(/mon|tue|wed|thu|fri|sat|sun/gi) ?? []).map((t) => t.toLowerCase());
    if (tokens.length < 6) return null;
    const cells = tokens.length === 7 ? tokens : undefined;
    const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const sel = text.match(/선택\s*요일\s*[:：]\s*(mon|tue|wed|thu|fri|sat|sun)/i);
    let weekdayButton: number | null = null;
    if (sel) {
      const pos = order.indexOf(sel[1]!.toLowerCase());
      if (pos >= 0) weekdayButton = (pos + 1) % 7; // 버튼위치(Mon=0..Sun=6) → 요일(0=일..6=토)
    }
    return { scan: { cells, tokens }, weekdayButton };
  }

  /**
   * 상단 요일 버튼(Mon~Sun)만 따로 인식한다. 이 버튼들은 연한 색·강조 스타일이라 카드 전체
   * OCR로는 뭉개지는데, 버튼 줄 영역만 잘라 요일 단어만 허용(whitelist)해 OCR하면 훨씬
   * 잘 읽힌다(실측 확인). 두 가지를 함께 뽑는다:
   *  - cells: 버튼 줄을 7칸으로 나눠 한 칸씩 인식(위치가 어긋난 버튼을 정확히 집어냄).
   *  - tokens: 버튼 줄 전체를 한 번에 인식(같은 요일 중복 감지).
   */
  async function extractWeekdayButtons(
    imageDataUrl: string,
  ): Promise<{ scan: smcc.WeekdayButtonScan; weekdayButton: number | null }> {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = imageDataUrl;
      });
      // 카드 상단 버튼 줄 영역(세로 10~18%).
      const y0 = Math.round(img.naturalHeight * 0.1);
      const yh = Math.max(1, Math.round(img.naturalHeight * 0.18) - y0);
      const W = img.naturalWidth;

      // 버튼 줄 전체를 한 장으로: 색 필터 없이(실측상 원본이 가장 잘 읽힘).
      const stripCanvas = document.createElement('canvas');
      stripCanvas.width = W;
      stripCanvas.height = yh;
      const sctx = stripCanvas.getContext('2d');
      if (!sctx) return { scan: {}, weekdayButton: null };
      sctx.drawImage(img, 0, y0, W, yh, 0, 0, W, yh);
      const stripUrl = stripCanvas.toDataURL('image/png');

      // 7칸: 버튼은 좌우 여백을 빼고 대략 가로 11~89% 구간에 균등 배치된다.
      // 색 필터 없이 원본 그대로 잘라야 인식이 가장 잘 된다(실측 확인).
      const x0 = W * 0.11;
      const cw = (W * 0.89 - x0) / 7;
      const cellUrls: string[] = [];
      // 각 칸의 "청록색 채움" 비율 — 선택(강조)된 버튼은 배경이 청록으로 꽉 차 있고 나머지는
      // 흰 배경에 얇은 테두리뿐이라, 채움 비율이 가장 큰 칸이 선택된 요일이다.
      const fillScores: number[] = [];
      for (let i = 0; i < 7; i++) {
        const cx = Math.round(x0 + i * cw);
        const cx2 = Math.round(x0 + (i + 1) * cw);
        const cwi = Math.max(1, cx2 - cx);
        const cc = document.createElement('canvas');
        cc.width = cwi;
        cc.height = yh;
        const cctx = cc.getContext('2d');
        if (!cctx) return { scan: {}, weekdayButton: null };
        cctx.drawImage(img, cx, y0, cwi, yh, 0, 0, cwi, yh);
        cellUrls.push(cc.toDataURL('image/png'));
        try {
          const { data } = cctx.getImageData(0, 0, cwi, yh);
          let teal = 0;
          const total = cwi * yh;
          for (let p = 0; p < data.length; p += 4) {
            const r = data[p]!;
            const g = data[p + 1]!;
            const b = data[p + 2]!;
            // 청록/파랑 계열: r 이 가장 낮고, g·b 가 충분히 높음(흰색·연한 테두리는 제외).
            if (r < 150 && g > 120 && b > 120 && g - r > 30 && b - r > 30) teal++;
          }
          fillScores.push(teal / total);
        } catch {
          fillScores.push(0);
        }
      }
      // 가장 채움이 큰 칸을 선택 버튼으로 본다(다른 칸보다 확실히 클 때만).
      let hi = -1;
      let hiScore = 0;
      let secondScore = 0;
      for (let i = 0; i < 7; i++) {
        if (fillScores[i]! > hiScore) {
          secondScore = hiScore;
          hiScore = fillScores[i]!;
          hi = i;
        } else if (fillScores[i]! > secondScore) {
          secondScore = fillScores[i]!;
        }
      }
      // 버튼 위치(0=Mon..6=Sun) → 요일 인덱스(0=일..6=토): Mon=1,...,Sun=0
      const highlightedWeekday =
        hi >= 0 && hiScore > 0.15 && hiScore > secondScore * 1.8 ? (hi + 1) % 7 : null;

      const { createWorker, PSM } = await import('tesseract.js');
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 40000),
      );
      const recognizePromise = (async (): Promise<smcc.WeekdayButtonScan> => {
        const worker = await createWorker('eng', 1, {
          workerPath: '/tesseract/worker.min.js',
          corePath: '/tesseract/tesseract-core-lstm.wasm.js',
          langPath: '/tessdata',
        });
        try {
          // 1) 전체 토큰
          await worker.setParameters({
            tessedit_pageseg_mode: PSM.SPARSE_TEXT,
            tessedit_char_whitelist: 'MonTueWedThuFriSatSun ',
            preserve_interword_spaces: '1',
          });
          const stripRes = await worker.recognize(stripUrl);
          const tokens = (stripRes.data.text.match(/\b(mon|tue|wed|thu|fri|sat|sun)\b/gi) ?? []).map(
            (t) => t.toLowerCase(),
          );
          // 2) 칸별
          await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
          const cells: Array<string | null> = [];
          for (const url of cellUrls) {
            const res = await worker.recognize(url);
            const m = res.data.text.match(/mon|tue|wed|thu|fri|sat|sun/i);
            cells.push(m ? m[0].toLowerCase() : null);
          }
          return { cells, tokens };
        } finally {
          await worker.terminate();
        }
      })();
      const scan = await Promise.race([recognizePromise, timeout]);
      return { scan, weekdayButton: highlightedWeekday };
    } catch {
      return { scan: {}, weekdayButton: null };
    }
  }

  const WEEKDAY_ROW_RE = /\b(mon|tue|wed|thu|fri|sat|sun)\b/gi;

  /**
   * 점선 구분선, 하단 SMCC 로고/워터마크처럼 OCR이 UI 장식 요소를 문자로 잘못 읽어낸 줄을
   * 걸러낸다. 이런 줄이 검수 결과에 섞이면 "표현/톤" 같은 엉뚱한 오탐이 나거나, 모든 카드에
   * 똑같이 나타나서(로고는 카드마다 항상 같은 문구니까) 슬라이드끼리 "중복 문장"으로 잘못
   * 잡히기도 한다. 상단 요일 버튼 줄("Mon Tue Wed...")은 여기서는 남겨둔다 — SMCC 규칙
   * 검수가 그 줄 자체의 오타(요일 중복/누락)를 검사하는 데 필요하기 때문(runRuleCheck 참고).
   * 일반 검수(중복 문장 등)에는 stripWeekdayRow 로 별도로 제거한 텍스트를 넘긴다.
   */
  function cleanOcrText(text: string): string {
    const logoRe = /seoul\s*morning\s*coffee\s*club/i;
    return text
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim();
        if (!trimmed) return false;
        // 카드 하단에 항상 똑같이 나오는 SMCC 로고/워터마크 줄은 실제 콘텐츠가 아니다.
        if (logoRe.test(trimmed)) return false;
        // 그 외 장식(점선/괄호/기호) 줄: 영숫자 비중이 너무 낮으면 버린다. 라벨처럼 짧은 줄은
        // (예: "Date") 건드리지 않기 위해 어느 정도 길이가 있는 줄만 검사한다.
        if (trimmed.length >= 6) {
          const alnum = (trimmed.match(/[\p{L}\p{N}]/gu) ?? []).length;
          if (alnum / trimmed.length < 0.35) return false;
        }
        // SMCC 로고 그림(워드마크)처럼 글자가 아닌 그래픽을 억지로 문자로 읽어낸 줄: 알파벳
        // 조각이 짧게 잔뜩 쪼개져 나온다("eL eSGEAEA C SE S..."). 평균 토큰 길이가 아주
        // 짧으면 실제 단어가 아니라 이런 노이즈로 보고 버린다.
        const tokens = trimmed.split(/\s+/).filter(Boolean);
        if (tokens.length >= 6) {
          const avgLen = tokens.reduce((sum, t) => sum + t.length, 0) / tokens.length;
          if (avgLen < 2.5) return false;
        }
        return true;
      })
      .join('\n')
      .trim();
  }

  /** 상단 장식용 요일 버튼 줄을 제거한다. 요일 단어가 2개 이상 나오면 실제 날짜가 아니라
   * 장식용 버튼 목록으로 본다. 일반 검수(오타/중복)에서 이 줄이 카드마다 똑같이 나타나
   * "중복 문장"으로 오탐 나는 걸 막기 위해 그쪽 입력에만 적용한다. */
  function stripWeekdayRow(text: string): string {
    return text
      .split('\n')
      .filter((line) => (line.match(WEEKDAY_ROW_RE) ?? []).length < 2)
      .join('\n')
      .trim();
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

  /** 왼쪽 슬라이드 목록에 보여줄 제목. 연동된 신청 건이 있으면 그 행사 정보로, 없으면 카드
   * 텍스트에서 추론한 프로그램명으로 표시한다 — OCR 원문 그대로 보여주면 알아보기 어렵다. */
  function slideTitle(s: SlideVM): string {
    const linked = resolveLinkedEvent(slideLinks[s.slideNumber]);
    if (linked) {
      return [smcc.programName(linked.programType, linked.languageMode), linked.dateRaw].filter(Boolean).join(' · ');
    }
    const text = s.editedText ?? s.rawText;
    if (text.trim()) {
      const { event } = smcc.analyzeStandaloneCard(text);
      const label = smcc.programName(event.programType, event.languageMode);
      if (label) return label;
    }
    return `슬라이드 ${s.slideNumber}`;
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
          {/* 1. 구글시트 연동(선택, 슬라이드별): 지금 고른 슬라이드에 신청 건을 연동해두면 그
              값을 기준(정답)으로 그 슬라이드 카드를 비교 검수한다. 이미지마다 다른 신청 건일
              수 있어서 연동은 슬라이드 하나하나에 따로 저장된다. */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50/50 px-4 py-3 text-sm">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
              1
            </span>
            <span className="font-semibold text-brand-800">
              구글시트 연동{current && <span className="font-normal text-brand-500"> · 슬라이드 {current.slideNumber}</span>}
            </span>
            <select
              value={browsingSheetType}
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
            {browsingSheetType && (
              <>
                <select
                  value={
                    current && slideLinks[current.slideNumber]?.sheetType === browsingSheetType
                      ? slideLinks[current.slideNumber]!.rowIndex
                      : ''
                  }
                  onChange={(e) => {
                    if (!current) return;
                    const idx = e.target.value === '' ? null : Number(e.target.value);
                    setSlideLinks((prev) => {
                      const next = { ...prev };
                      if (idx == null) delete next[current.slideNumber];
                      else next[current.slideNumber] = { sheetType: browsingSheetType, rowIndex: idx };
                      return next;
                    });
                  }}
                  disabled={!current || browsingData?.loading || browsingEvents.length === 0}
                  className="max-w-[240px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none"
                >
                  <option value="">신청 건 선택</option>
                  {browsingEvents.map((ev, i) => (
                    <option key={i} value={i}>
                      {[ev.dateRaw, ev.cafeName, ev.hostInstagram].filter(Boolean).join(' · ') || `행 ${i + 1}`}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void ensureSheetLoaded(browsingSheetType, true)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-slate-400 hover:bg-white"
                  title="다시 불러오기"
                >
                  <RefreshCw className={cn('h-4 w-4', browsingData?.loading && 'animate-spin')} />
                </button>
                {browsingData?.source && (
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[11px]',
                      browsingData.source === 'live' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                    )}
                  >
                    {browsingData.source === 'live' ? '실시간' : '예시'}
                  </span>
                )}
                {browsingData?.message && <span className="text-xs text-slate-400">{browsingData.message}</span>}
              </>
            )}
            {current &&
              (() => {
                const ev = resolveLinkedEvent(slideLinks[current.slideNumber]);
                return ev ? (
                  <span className="font-medium text-brand-700">
                    연동됨: {ev.cafeName} · {ev.languageLabelExpected}
                  </span>
                ) : null;
              })()}
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
                  <span className="block truncate text-xs text-slate-500">{slideTitle(s)}</span>
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
