import { PROGRAM_CONFIG } from '../program-config';
import type { NormalizedEvent, RawSmccIssue } from '../schemas';

/** Espresso Run 등 거리/코스 필수 프로그램 검사 */
export function validateEventRoute(e: NormalizedEvent): RawSmccIssue[] {
  const issues: RawSmccIssue[] = [];
  const config = PROGRAM_CONFIG[e.programType];

  if (config.requiresDistance && e.distanceKm == null) {
    issues.push({
      category: 'program-rule',
      severity: 'warning',
      title: '거리 누락',
      description: `${config.nameKr} 은 거리 표기가 필요합니다. (예: 6km)`,
      confidence: 0.7,
    });
  }
  if (config.requiresRoute && e.routeStops.length === 0) {
    issues.push({
      category: 'program-rule',
      severity: 'warning',
      title: '코스 누락',
      description: `${config.nameKr} 은 코스 표기가 필요합니다.`,
      confidence: 0.7,
    });
  }
  return issues;
}
