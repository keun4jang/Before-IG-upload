'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, Save, Trash2 } from 'lucide-react';
import { smcc } from '@big/shared';
import { Card, CardContent, cn } from '@big/ui';
import { loadSheet, loadWork, saveWork, type SheetTable } from '@/lib/smcc-client';
import { clearLogs, downloadLogs, logCount, saveSmccLog } from '@/lib/smcc-log';
import { SourceSelector } from '@/components/smcc/source-selector';
import { RowList, type RowSummary } from '@/components/smcc/row-list';
import { FieldTable, type FieldRow } from '@/components/smcc/field-table';
import { CanonicalFields } from '@/components/smcc/canonical-fields';
import { CardReviewer } from '@/components/smcc/card-reviewer';
import { IssueList } from '@/components/smcc/issue-list';
import { PlaceVerificationCard } from '@/components/smcc/place-verification-card';

function normalizedRows(e: smcc.NormalizedEvent): FieldRow[] {
  const loc = e.languageMode === 'EN' ? e.locationCanonicalEn : e.locationCanonicalKr;
  return [
    { label: '프로그램', value: smcc.programName(e.programType, e.languageMode) },
    { label: '언어', value: e.languageLabelExpected },
    { label: '지역', value: loc },
    { label: '날짜', value: e.dateIso ? (e.languageMode === 'EN' ? e.dateLabelEn : e.dateLabelKr) : e.dateRaw },
    { label: '시간', value: e.timeLabel || e.startTimeRaw },
    { label: '참가비', value: e.feeLabelExpected },
    { label: '카페', value: [e.cafeName, e.cafeBranch].filter(Boolean).join(' ') },
    { label: '주소', value: e.cafeAddress },
    { label: '집결지', value: e.meetupSpotName },
    { label: '코스', value: e.routeRaw },
    { label: '거리', value: e.distanceKm != null ? `${e.distanceKm}km` : '' },
    { label: '호스트', value: e.hostInstagram },
  ];
}

function rawRows(e: smcc.NormalizedEvent): FieldRow[] {
  return Object.entries(e.raw).map(([label, value]) => ({ label: label.slice(0, 20), value }));
}

export default function SmccPage() {
  const [sheetType, setSheetType] = useState<smcc.SheetType>('espresso-run');
  const [table, setTable] = useState<SheetTable>({ headers: [], rows: [] });
  const [source, setSource] = useState<'live' | 'fixture'>('fixture');
  const [message, setMessage] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const [cardText, setCardText] = useState('');
  const [cardImage, setCardImage] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [memo, setMemo] = useState('');
  const [logs, setLogs] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => setLogs(logCount()), []);

  const sheetMeta = smcc.SHEET_SOURCES.find((s) => s.type === sheetType)!;

  async function load(type: smcc.SheetType) {
    setLoading(true);
    setSelected(null);
    const src = smcc.SHEET_SOURCES.find((s) => s.type === type)!;
    const { table: t, source: srcKind, message: msg } = await loadSheet(type, src.url);
    setTable(t);
    setSource(srcKind);
    setMessage(msg);
    setLoading(false);
  }

  useEffect(() => {
    void load(sheetType);
  }, [sheetType]);

  const events = useMemo<smcc.NormalizedEvent[]>(() => {
    if (table.rows.length === 0) return [];
    return smcc.normalizeSheet(sheetType, sheetMeta.url, table.headers, table.rows);
  }, [table, sheetType, sheetMeta.url]);

  const summaries = useMemo<RowSummary[]>(
    () =>
      events.map((event, index) => {
        const issues = smcc.validateEvent(event);
        return {
          index,
          event,
          errorCount: issues.filter((i) => i.severity === 'error').length,
          warnCount: issues.filter((i) => i.severity === 'warning').length,
        };
      }),
    [events],
  );

  const event = selected != null ? events[selected] : undefined;
  const review = useMemo(
    () => (event ? smcc.reviewEvent(event, cardText) : null),
    [event, cardText],
  );

  // 행 선택 시 저장된 작업 로드
  function selectRow(i: number) {
    setSelected(i);
    const work = loadWork(sheetType, i);
    setCardText(work?.cardText ?? '');
    setResolved(new Set(work?.resolved ?? []));
    setMemo(work?.memo ?? '');
    setCardImage(null);
  }

  // 현재 검수 상태를 기록(로컬 + 서버 best-effort). 놓친 케이스 재현·수정용 데이터 수집.
  function saveLog() {
    if (!event || !review) return;
    saveSmccLog({
      sheetType,
      rowIndex: selected,
      cafeName: event.cafeName,
      cardText,
      imageDataUrl: cardImage ?? undefined,
      memo,
      event,
      canonical: review.canonical,
      issues: review.issues,
    });
    setLogs(logCount());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  // 작업 자동 저장
  useEffect(() => {
    if (selected == null) return;
    saveWork(sheetType, selected, {
      cardText,
      resolved: [...resolved],
      memo,
      updatedAt: new Date().toISOString(),
    });
  }, [sheetType, selected, cardText, resolved, memo]);

  function toggleResolved(id: string) {
    setResolved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const openIssues = review?.issues.filter((i) => !resolved.has(i.id)) ?? [];
  const errorCount = openIssues.filter((i) => i.severity === 'error').length;
  const warnCount = openIssues.filter((i) => i.severity === 'warning').length;
  const ready = review != null && errorCount === 0 && warnCount === 0;

  return (
    <div className="container-page py-5">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold tracking-tight">SMCC 검수</h1>
        <SourceSelector value={sheetType} onChange={setSheetType} />
        <button
          onClick={() => load(sheetType)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> 불러오기
        </button>
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[11px]',
            source === 'live'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
          )}
        >
          {source === 'live' ? '실시간' : '예시'}
        </span>
        {message && <span className="text-[11px] text-slate-400">{message}</span>}
        <span className="ml-auto text-xs text-slate-400">{events.length}건</span>
        {/* 데이터 수집: 검수 기록 저장 / 내보내기 / 비우기 */}
        <div className="flex items-center gap-1">
          <button
            onClick={saveLog}
            disabled={!event}
            className="inline-flex items-center gap-1 rounded-md bg-smcc-500 px-2 py-1 text-xs font-medium text-white hover:bg-smcc-600 disabled:opacity-40"
            title="현재 카드/입력/검출 이슈를 기록"
          >
            <Save className="h-3.5 w-3.5" /> {saved ? '저장됨' : '기록'}
          </button>
          <button
            onClick={downloadLogs}
            disabled={logs === 0}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
            title="수집한 기록 전체를 JSON 으로 내보내기"
          >
            <Download className="h-3.5 w-3.5" /> {logs}
          </button>
          {logs > 0 && (
            <button
              onClick={() => {
                if (confirm('수집한 기록을 모두 지울까요?')) {
                  clearLogs();
                  setLogs(0);
                }
              }}
              className="rounded-md px-1.5 py-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
              title="기록 비우기"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[240px_1fr]">
        {/* 행 목록 */}
        <div>
          <RowList rows={summaries} selected={selected} onSelect={selectRow} />
        </div>

        {/* 상세 */}
        {event && review ? (
          <div className="grid gap-3 xl:grid-cols-[1fr_1fr_320px]">
            {/* 좌: 원본/정규화/장소 */}
            <div className="space-y-3">
              <Card>
                <CardContent className="pt-4">
                  <p className="mb-1 text-xs font-semibold text-slate-500">정규화</p>
                  <FieldTable rows={normalizedRows(event)} copyable />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <PlaceVerificationCard cafeName={event.cafeName} cafeAddress={event.cafeAddress} />
                </CardContent>
              </Card>
              <details className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900/60">
                <summary className="cursor-pointer text-xs font-semibold text-slate-500">원본</summary>
                <div className="mt-2">
                  <FieldTable rows={rawRows(event)} />
                </div>
              </details>
            </div>

            {/* 중앙: 정답/카드 */}
            <div className="space-y-3">
              <Card>
                <CardContent className="pt-4">
                  <CanonicalFields canonical={review.canonical} />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <CardReviewer value={cardText} onChange={setCardText} onImageChange={setCardImage} />
                </CardContent>
              </Card>
            </div>

            {/* 우: 이슈/상태 */}
            <div className="space-y-3">
              <Card>
                <CardContent className="pt-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">상태</span>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[11px] font-medium',
                        ready
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : errorCount > 0
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
                      )}
                    >
                      {ready ? '완료 가능' : errorCount > 0 ? '수정 필요' : '확인 필요'}
                    </span>
                    <span className="ml-auto text-[11px] text-slate-400">
                      오류 {errorCount} · 경고 {warnCount}
                    </span>
                  </div>
                  <IssueList issues={review.issues} resolved={resolved} onToggle={toggleResolved} />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="mb-1 text-xs font-semibold text-slate-500">메모</p>
                  <textarea
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="메모"
                    className="min-h-[60px] w-full resize-y rounded-md border border-slate-200 bg-white p-2 text-sm outline-none focus:border-smcc-400 dark:border-slate-700 dark:bg-slate-900"
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center text-sm text-slate-400">
              왼쪽에서 행을 선택하세요.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
