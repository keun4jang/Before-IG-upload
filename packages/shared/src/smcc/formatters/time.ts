/** 시간 파싱/포맷 (24h 내부 표준, 카드 라벨은 AM/PM 12h). */

/** "AM 8:00" / "AM7:00" / "오전 7시" / "07:00" / "7:30 AM" → "HH:MM" */
export function parseTime(raw: string): string | null {
  const t = (raw ?? '').trim();
  if (!t) return null;

  const ampm = /pm|오후/i.test(t) ? 'pm' : /am|오전/i.test(t) ? 'am' : null;

  const m = t.match(/(\d{1,2})\s*[:시]\s*(\d{1,2})?/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? '0');
  if (h > 23 || min > 59) return null;

  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;

  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (h! * 60 + m! + minutes) % (24 * 60);
  const t = total < 0 ? total + 24 * 60 : total;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** "07:00" → "AM7:00" */
export function to12hLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h! < 12 ? 'AM' : 'PM';
  let h12 = h! % 12;
  if (h12 === 0) h12 = 12;
  return `${ampm}${h12}:${String(m).padStart(2, '0')}`;
}

/** 시작/종료 → "AM7:00–AM8:00" (en-dash) */
export function formatTimeLabel(start24: string, end24: string): string {
  return `${to12hLabel(start24)}–${to12hLabel(end24)}`;
}
