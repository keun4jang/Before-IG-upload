import { getAppSettings } from '@/lib/env';
import { ok } from '@/lib/http';

export const dynamic = 'force-dynamic';

export function GET() {
  return ok({
    status: 'ok',
    time: new Date().toISOString(),
    settings: getAppSettings(),
  });
}
