/** Google Sheets(public) 가져오기 & CSV 파싱 헬퍼 (순수, 브라우저/서버 공용). */

export interface SheetRef {
  id: string;
  gid: string | null;
}

/** 스프레드시트 URL 에서 id/gid 파싱 */
export function parseSheetUrl(url: string): SheetRef | null {
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;
  const gidMatch = url.match(/[?#&]gid=(\d+)/);
  return { id: idMatch[1]!, gid: gidMatch ? gidMatch[1]! : null };
}

/** CSV export URL */
export function csvExportUrl(ref: SheetRef): string {
  const base = `https://docs.google.com/spreadsheets/d/${ref.id}/export?format=csv`;
  return ref.gid ? `${base}&gid=${ref.gid}` : base;
}

/** RFC4180 기반 CSV 파서 (따옴표/줄바꿈 처리) */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c === '\r') {
      // skip
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function norm(s: string): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, '');
}

/** 헤더에서 키워드로 컬럼 인덱스 찾기 */
export function pickIndex(
  headers: string[],
  keywords: string[],
  exclude: string[] = [],
): number {
  const normHeaders = headers.map(norm);
  const kw = keywords.map(norm);
  const ex = exclude.map(norm);
  for (let i = 0; i < normHeaders.length; i++) {
    const h = normHeaders[i]!;
    if (!kw.some((k) => h.includes(k))) continue;
    if (ex.some((e) => h.includes(e))) continue;
    return i;
  }
  return -1;
}

export function cell(row: string[], idx: number): string {
  if (idx < 0) return '';
  return (row[idx] ?? '').trim();
}

export interface SheetTable {
  headers: string[];
  rows: string[][]; // 데이터 행 (헤더 제외)
}

/** rows → 헤더 + 데이터행(빈 행 제거) */
export function toTable(rows: string[][]): SheetTable {
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0]!;
  const dataRows = rows.slice(1).filter((r) => r.some((c) => (c ?? '').trim().length > 0));
  return { headers, rows: dataRows };
}
