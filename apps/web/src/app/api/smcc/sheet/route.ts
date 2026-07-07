import { smcc } from '@big/shared';
import { fail, handler, ok } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** 공개 Google Sheet CSV 를 가져와 헤더/행으로 반환 */
export const GET = handler(async (req: Request) => {
  const url = new URL(req.url).searchParams.get('url');
  if (!url) return fail('시트 URL이 필요합니다.', 400);

  const ref = smcc.parseSheetUrl(url);
  if (!ref) return fail('올바른 스프레드시트 URL이 아닙니다.', 400);

  const csvUrl = smcc.csvExportUrl(ref);
  let text: string;
  try {
    const res = await fetch(csvUrl, {
      headers: { 'user-agent': 'Mozilla/5.0 (SMCC-review)' },
      redirect: 'follow',
    });
    if (!res.ok) return fail(`시트를 불러오지 못했습니다 (${res.status}).`, 502);
    text = await res.text();
  } catch {
    return fail('시트 요청에 실패했습니다.', 502);
  }

  if (text.trimStart().startsWith('<!DOCTYPE') || text.includes('<html')) {
    return fail('공개 시트가 아니거나 접근이 제한되어 있습니다.', 403);
  }

  const table = smcc.toTable(smcc.parseCsv(text));
  return ok({ headers: table.headers, rows: table.rows });
});
