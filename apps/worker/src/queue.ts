/**
 * 공유 큐 정의. web(생산자)과 worker(소비자)가 함께 사용합니다.
 */
import type { AnalysisInput } from '@big/shared';

export const ANALYSIS_QUEUE = 'analysis-run';

export interface AnalysisJobData {
  runId: string;
  projectId: string;
  input: AnalysisInput;
}

export function getRedisConnection(): { url: string } | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  return { url };
}
