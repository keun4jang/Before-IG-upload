'use client';

import { useMemo, useState } from 'react';
import { smcc } from '@big/shared';
import { Card, CardContent, cn } from '@big/ui';
import { CardReviewer } from './card-reviewer';
import { IssueList } from './issue-list';
import { saveSmccLog } from '@/lib/smcc-log';

const WD = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 시트 없이 카드(이미지 OCR / 붙여넣기)만으로 검수.
 * 프로그램/언어/지역/날짜는 카드에서 추론하고, 카드 자체 규칙 위반을 검출.
 */
export function StandaloneReviewer({ onLogged }: { onLogged: () => void }) {
  const [cardText, setCardText] = useState('');
  const [cardImage, setCardImage] = useState<string | null>(null);
  const [weekdayBtn, setWeekdayBtn] = useState<number | null>(null);
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const { event, issues } = useMemo(
    () => smcc.analyzeStandaloneCard(cardText, { weekdayButton: weekdayBtn }),
    [cardText, weekdayBtn],
  );

  const open = issues.filter((i) => !resolved.has(i.id));
  const errorCount = open.filter((i) => i.severity === 'error').length;
  const warnCount = open.filter((i) => i.severity === 'warning').length;
  const infoCount = open.filter((i) => i.severity === 'info').length;
  const analyzed = cardText.trim().length > 0;

  function toggle(id: string) {
    setResolved((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function save() {
    saveSmccLog({
      sheetType: 'standalone',
      rowIndex: null,
      cafeName: '',
      cardText,
      imageDataUrl: cardImage ?? undefined,
      event,
      canonical: smcc.buildCanonicalCard(event),
      issues,
    });
    onLogged();
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        <Card>
          <CardContent className="pt-4">
            <div className="mb-3">
              <span className="mb-1 block text-xs font-semibold text-slate-500">요일 버튼</span>
              <div className="flex flex-wrap gap-1">
                {WD.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => setWeekdayBtn((w) => (w === i ? null : i))}
                    className={cn(
                      'h-7 w-7 rounded-md text-xs font-medium transition',
                      weekdayBtn === i
                        ? 'bg-smcc-500 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700',
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <CardReviewer value={cardText} onChange={setCardText} onImageChange={setCardImage} />
          </CardContent>
        </Card>
        {analyzed && (
          <Card>
            <CardContent className="pt-4">
              <p className="mb-2 text-xs font-semibold text-slate-500">추론</p>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <span className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                  {smcc.programName(event.programType, event.languageMode)}
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                  {event.languageMode === 'KR' ? '한국어' : 'English'}
                </span>
                {event.locationCanonicalKr && (
                  <span className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                    {event.locationCanonicalKr}
                  </span>
                )}
                {event.dateRaw && (
                  <span className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{event.dateRaw}</span>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div>
        <Card className="lg:sticky lg:top-20">
          <CardContent className="pt-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">상태</span>
              {analyzed && (
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[11px] font-medium',
                    errorCount > 0
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      : warnCount > 0
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
                  )}
                >
                  {errorCount > 0 ? '수정 필요' : warnCount > 0 ? '확인 권장' : '이상 없음'}
                </span>
              )}
              {analyzed && (
                <span className="text-[11px] text-slate-400">
                  오류 {errorCount} · 경고 {warnCount} · 확인 {infoCount}
                </span>
              )}
              <button
                onClick={save}
                disabled={!analyzed}
                className="ml-auto rounded-md bg-smcc-500 px-2 py-1 text-xs font-medium text-white hover:bg-smcc-600 disabled:opacity-40"
              >
                기록
              </button>
            </div>
            {analyzed ? (
              <IssueList issues={issues} resolved={resolved} onToggle={toggle} />
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">
                카드 이미지를 올리거나 텍스트를 붙여넣으세요.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
