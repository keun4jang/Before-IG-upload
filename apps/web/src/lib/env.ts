/**
 * 환경변수 파싱 및 런타임 설정. 서버에서만 사용.
 */
import type { AppSettings } from '@big/shared';

function bool(v: string | undefined, def = false): boolean {
  if (v == null) return def;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

const hasDatabase = !!process.env.DATABASE_URL;

export const env = {
  demoMode: bool(process.env.DEMO_MODE, !hasDatabase),
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  analysisMode: (process.env.ANALYSIS_MODE ?? 'auto') as 'auto' | 'sync' | 'queue',

  storageDriver: (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 's3',
  localStorageDir: process.env.LOCAL_STORAGE_DIR ?? '.storage',

  ocrProvider: (process.env.OCR_PROVIDER ?? 'dummy') as 'dummy' | 'tesseract' | 'google',
  llmProvider: (process.env.LLM_PROVIDER ?? 'none') as 'none' | 'openai' | 'anthropic',
  searchProvider: (process.env.SEARCH_PROVIDER ?? 'none') as 'none' | 'tavily' | 'serpapi',

  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5',

  tavilyApiKey: process.env.TAVILY_API_KEY,
  serpapiApiKey: process.env.SERPAPI_API_KEY,
  googleVisionApiKey: process.env.GOOGLE_VISION_API_KEY,
  /** 구글시트 안의 탭(gid) 목록을 자동으로 찾기 위한 읽기 전용 API 키. 없으면 지정된 gid 하나만 사용. */
  googleSheetsApiKey: process.env.GOOGLE_SHEETS_API_KEY,

  authEnabled: bool(process.env.AUTH_ENABLED, false),
};

/** 사실 검토 활성화 여부: LLM 또는 Search provider 중 하나라도 설정되어야 함. */
export function isFactCheckEnabled(): boolean {
  const hasSearch = env.searchProvider !== 'none';
  const hasLlm = env.llmProvider !== 'none';
  return hasSearch || hasLlm;
}

export function getAppSettings(): AppSettings {
  return {
    ocrProvider: env.ocrProvider,
    llmProvider: env.llmProvider,
    searchProvider: env.searchProvider,
    storageDriver: env.storageDriver,
    factCheckEnabled: isFactCheckEnabled(),
    demoMode: env.demoMode,
  };
}
