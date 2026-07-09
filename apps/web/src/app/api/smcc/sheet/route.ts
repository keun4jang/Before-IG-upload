import { smcc } from '@big/shared';
import { fail, handler, ok } from '@/lib/http';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

interface SheetTabMeta {
  gid: string;
  title: string;
}

interface SheetTabTable {
  title: string;
  headers: string[];
  rows: string[][];
}

/** Sheets API(읽기 전용 키)로 스프레드시트 안의 전체 탭(gid) 목록을 가져온다. */
async function listSheetTabs(spreadsheetId: string): Promise<SheetTabMeta[]> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)&key=${env.googleSheetsApiKey}`,
  );
  if (!res.ok) throw new Error(`탭 목록 조회 실패 (${res.status})`);
  const data = (await res.json()) as {
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
  };
  return (data.sheets ?? [])
    .map((s) => ({ gid: String(s.properties?.sheetId ?? 0), title: s.properties?.title ?? '' }))
    .filter((s) => s.title);
}

async function fetchCsvTable(id: string, gid: string): Promise<{ headers: string[]; rows: string[][] }> {
  const csvUrl = smcc.csvExportUrl({ id, gid });
  const res = await fetch(csvUrl, {
    headers: { 'user-agent': 'Mozilla/5.0 (SMCC-review)' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`시트를 불러오지 못했습니다 (${res.status}).`);
  const text = await res.text();
  if (text.trimStart().startsWith('<!DOCTYPE') || text.includes('<html')) {
    throw new Error('공개 시트가 아니거나 접근이 제한되어 있습니다.');
  }
  return smcc.toTable(smcc.parseCsv(text));
}

/**
 * 공개 Google Sheet CSV 를 가져와 탭별로 헤더/행을 반환.
 * GOOGLE_SHEETS_API_KEY 가 설정돼 있으면, 지정된 gid 탭 하나만이 아니라 같은 스프레드시트 안의
 * "모든 탭"(예: 지난 신청 아카이브 탭)을 찾아서 각각 반환한다. 탭마다 열 구성이 달라도(예: 원본
 * 응답 탭 vs 캡션 작성용 탭) 강제로 한 표로 합치지 않고 탭별로 따로 넘겨서, 호출부가 각 탭을
 * 자기 헤더 기준으로 정규화하게 한다 — 열 개수가 다르다고 데이터가 통째로 누락되지 않도록.
 */
export const GET = handler(async (req: Request) => {
  const url = new URL(req.url).searchParams.get('url');
  if (!url) return fail('시트 URL이 필요합니다.', 400);

  const ref = smcc.parseSheetUrl(url);
  if (!ref) return fail('올바른 스프레드시트 URL이 아닙니다.', 400);

  if (!env.googleSheetsApiKey) {
    try {
      const table = await fetchCsvTable(ref.id, ref.gid ?? '');
      return ok({ tabs: [{ title: '', headers: table.headers, rows: table.rows }] });
    } catch (err) {
      return fail(err instanceof Error ? err.message : '시트 요청에 실패했습니다.', 502);
    }
  }

  let tabMetas: SheetTabMeta[];
  try {
    tabMetas = await listSheetTabs(ref.id);
  } catch {
    // 탭 목록 조회 실패(키 오류 등) 시 지정된 gid 하나만이라도 반환
    try {
      const table = await fetchCsvTable(ref.id, ref.gid ?? '');
      return ok({ tabs: [{ title: '', headers: table.headers, rows: table.rows }] });
    } catch (err) {
      return fail(err instanceof Error ? err.message : '시트 요청에 실패했습니다.', 502);
    }
  }
  if (tabMetas.length === 0) return fail('스프레드시트에서 탭을 찾지 못했습니다.', 502);

  const tabs: SheetTabTable[] = [];
  for (const meta of tabMetas) {
    let table: { headers: string[]; rows: string[][] };
    try {
      table = await fetchCsvTable(ref.id, meta.gid);
    } catch {
      continue;
    }
    if (table.headers.length === 0 || table.rows.length === 0) continue;
    tabs.push({ title: meta.title, headers: table.headers, rows: table.rows });
  }

  if (tabs.length === 0) return fail('시트 데이터를 찾지 못했습니다.', 502);
  return ok({ tabs });
});
