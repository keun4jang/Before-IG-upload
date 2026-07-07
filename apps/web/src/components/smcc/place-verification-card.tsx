'use client';

import { useState } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';
import { smcc } from '@big/shared';
import { cn } from '@big/ui';
import { mapSearchUrl, verifyPlace, webSearchUrl } from '@/lib/smcc-client';

const VERDICT_LABEL: Record<smcc.PlaceVerdict, string> = {
  'likely-match': '일치 가능성 높음',
  'possible-mismatch': '불일치 가능성',
  'not-verifiable': '검증 불가',
  'manual-review': '수동 확인',
};
const VERDICT_STYLE: Record<smcc.PlaceVerdict, string> = {
  'likely-match': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  'possible-mismatch': 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  'not-verifiable': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  'manual-review': 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
};

export function PlaceVerificationCard({ cafeName, cafeAddress }: { cafeName: string; cafeAddress: string }) {
  const query = [cafeName, cafeAddress].filter(Boolean).join(' ');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    verdict: smcc.PlaceVerdict;
    confidence: number;
    candidates: smcc.PlaceCandidate[];
  } | null>(null);

  async function run() {
    if (!query.trim()) return;
    setLoading(true);
    const { candidates } = await verifyPlace(query);
    const m = smcc.matchPlace(cafeName || query, candidates);
    setResult({ verdict: m.verdict, confidence: m.confidence, candidates });
    setLoading(false);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">장소 확인</span>
        <button
          onClick={run}
          disabled={loading || !query.trim()}
          className="rounded-md bg-smcc-500 px-2 py-0.5 text-xs font-medium text-white hover:bg-smcc-600 disabled:opacity-40"
        >
          {loading ? '확인 중' : '교차확인'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <a href={mapSearchUrl(query)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-smcc-600 hover:underline">
          <MapPin className="h-3 w-3" /> 지도
        </a>
        <a href={webSearchUrl(query)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-smcc-600 hover:underline">
          <ExternalLink className="h-3 w-3" /> 검색
        </a>
      </div>

      {result && (
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', VERDICT_STYLE[result.verdict])}>
              {VERDICT_LABEL[result.verdict]}
            </span>
            <span className="text-xs text-slate-400">신뢰도 {Math.round(result.confidence * 100)}%</span>
          </div>
          {result.candidates.length > 0 ? (
            <ul className="mt-1.5 space-y-1">
              {result.candidates.slice(0, 3).map((c, i) => (
                <li key={i} className="line-clamp-1 text-xs text-slate-500">
                  {c.displayName}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-slate-400">외부 후보 없음 — 수동 확인 권장</p>
          )}
        </div>
      )}
      <p className="mt-2 text-[11px] text-slate-400">외부 검색 결과는 참고용입니다. 단정하지 마세요.</p>
    </div>
  );
}
