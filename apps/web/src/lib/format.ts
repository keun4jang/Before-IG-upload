import type { BadgeProps } from '@big/ui';
import type { ClaimVerdict, IssueSeverity, ScoreLabel } from '@big/shared';

type Tone = NonNullable<BadgeProps['tone']>;

export const severityTone: Record<IssueSeverity, Tone> = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
};

export const scoreTone: Record<ScoreLabel, Tone> = {
  good: 'success',
  review: 'warning',
  fix: 'danger',
};

export const verdictTone: Record<ClaimVerdict, Tone> = {
  mostly_supported: 'success',
  partially_unclear: 'warning',
  insufficient_evidence: 'warning',
  conflicting: 'danger',
  review_needed: 'neutral',
};

export function scoreColor(score: number): string {
  if (score >= 85) return '#059669'; // emerald-600
  if (score >= 65) return '#d97706'; // amber-600
  return '#e11d48'; // rose-600
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}
