import { fail, handler, ok } from '@/lib/http';

export const dynamic = 'force-dynamic';

interface NominatimItem {
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
}

/** OpenStreetMap Nominatim 무료 지오코딩으로 카페/주소 후보 검색 */
export const GET = handler(async (req: Request) => {
  const q = new URL(req.url).searchParams.get('q');
  if (!q || !q.trim()) return fail('검색어가 필요합니다.', 400);

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('addressdetails', '0');

  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': 'SMCC-review/1.0 (contact: ops@smcc.example)',
        'accept-language': 'ko,en',
      },
    });
    if (!res.ok) return ok({ candidates: [], degraded: true });
    const data = (await res.json()) as NominatimItem[];
    const candidates = data.map((d) => ({
      displayName: d.display_name,
      lat: Number(d.lat),
      lon: Number(d.lon),
      type: d.type,
    }));
    return ok({ candidates, degraded: false });
  } catch {
    return ok({ candidates: [], degraded: true });
  }
});
