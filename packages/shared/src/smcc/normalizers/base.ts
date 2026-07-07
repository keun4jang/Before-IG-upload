import { LANGUAGE_LABEL, LOCATIONS } from '../constants';
import { PROGRAM_CONFIG, SHEET_TO_LANGUAGE, SHEET_TO_PROGRAM } from '../program-config';
import type { LanguageMode, NormalizedEvent, RouteStop, SheetType } from '../schemas';
import { cell, pickIndex } from '../csv';
import { formatDateEn, formatDateKr, parseDate, weekdayFromText, weekdayOf } from '../formatters/date';
import { addMinutes, formatTimeLabel, parseTime } from '../formatters/time';
import { resolveFee } from '../formatters/labels';

/** 시트별 컬럼 키워드 매핑 */
export interface ColumnKeywords {
  date: string[];
  time: string[];
  region: string[];
  cafeName: string[];
  cafeNameExclude?: string[];
  cafeAddress: string[];
  branch?: string[];
  host: string[];
  language?: string[];
  notes?: string[];
  // Espresso Run 전용
  meetupName?: string[];
  meetupNameExclude?: string[];
  meetupAddress?: string[];
  course?: string[];
  distance?: string[];
  pace?: string[];
  baggage?: string[];
}

export interface NormalizeMeta {
  sheetType: SheetType;
  sheetUrl: string;
  rowIndex: number;
  refDate?: Date;
}

function canonLocation(raw: string): { kr: string; en: string } {
  const n = raw.toLowerCase();
  for (const loc of LOCATIONS) {
    if (loc.match.some((m) => n.includes(m.toLowerCase()))) {
      return { kr: loc.kr, en: loc.en };
    }
  }
  return { kr: raw, en: raw };
}

function parseRoute(raw: string): RouteStop[] {
  if (!raw.trim()) return [];
  return raw
    .split(/[→>\/·,\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((name) => ({ name }));
}

function parseDistance(raw: string): number | null {
  const m = raw.match(/(\d+(?:\.\d+)?)\s*km/i);
  return m ? Number(m[1]) : null;
}

export function baseNormalize(
  headers: string[],
  row: string[],
  kw: ColumnKeywords,
  meta: NormalizeMeta,
): NormalizedEvent {
  const programType = SHEET_TO_PROGRAM[meta.sheetType];
  const config = PROGRAM_CONFIG[programType];

  const get = (keys: string[] | undefined, exclude: string[] = []) =>
    keys ? cell(row, pickIndex(headers, keys, exclude)) : '';

  const dateRaw = get(kw.date);
  const timeRaw = get(kw.time);
  const locationRaw = get(kw.region);
  const cafeName = get(kw.cafeName, kw.cafeNameExclude ?? ['주소', 'address']);
  const cafeAddress = get(kw.cafeAddress);
  const cafeBranch = get(kw.branch);
  const hostInstagram = get(kw.host);
  const notes = get(kw.notes);
  const languageRaw = get(kw.language);

  const meetupSpotName = get(kw.meetupName, kw.meetupNameExclude ?? ['주소', 'address']);
  const meetupSpotAddress = get(kw.meetupAddress);
  const routeRaw = get(kw.course);
  const distanceRaw = get(kw.distance);
  const estimatedPace = get(kw.pace);
  const baggageStorage = get(kw.baggage);

  // 언어 결정
  let languageMode: LanguageMode = SHEET_TO_LANGUAGE[meta.sheetType];
  if (kw.language && languageRaw) {
    if (/english/i.test(languageRaw)) languageMode = 'EN';
    else if (/한국어|korean/i.test(languageRaw)) languageMode = 'KR';
  }

  // 날짜
  const pd = parseDate(dateRaw, meta.refDate ?? new Date());
  const dateIso = pd.iso;
  const weekdayExpected = dateIso ? weekdayOf(dateIso) : null;
  const weekdayRawText = weekdayFromText(dateRaw);
  const dateLabelKr = dateIso ? formatDateKr(dateIso) : '';
  const dateLabelEn = dateIso ? formatDateEn(dateIso) : '';

  // 시간
  const startTime24h = parseTime(timeRaw);
  const endTimeDerived24h = startTime24h ? addMinutes(startTime24h, config.durationMin) : null;
  const timeLabel = startTime24h && endTimeDerived24h
    ? formatTimeLabel(startTime24h, endTimeDerived24h)
    : '';

  const loc = canonLocation(locationRaw);
  const routeStops = parseRoute(routeRaw);
  const distanceKm = parseDistance(distanceRaw);

  const cafeCount = routeStops.length > 0 ? routeStops.length : 1;
  const fee = resolveFee(programType, languageMode, cafeCount);

  const raw: Record<string, string> = {};
  headers.forEach((h, i) => {
    if (h && h.trim()) raw[h.trim()] = (row[i] ?? '').trim();
  });

  return {
    id: `${meta.sheetType}-${meta.rowIndex}`,
    sourceSheetType: meta.sheetType,
    sourceSheetUrl: meta.sheetUrl,
    sourceRowIndex: meta.rowIndex,
    programType,
    languageMode,
    languageLabelExpected:
      config.allowAnyLanguage && languageMode === 'EN' ? 'Any language' : LANGUAGE_LABEL[languageMode],
    locationRaw,
    locationCanonicalKr: loc.kr,
    locationCanonicalEn: loc.en,
    dateRaw,
    dateIso,
    weekdayExpected,
    weekdayRaw: weekdayRawText != null ? dateRaw : '',
    dateLabelKr,
    dateLabelEn,
    startTimeRaw: timeRaw,
    startTime24h,
    endTimeDerived24h,
    timeLabel,
    meetupSpotName,
    meetupSpotAddress,
    cafeName,
    cafeBranch,
    cafeAddress,
    routeRaw,
    routeStops,
    distanceKm,
    estimatedPace,
    hostInstagram: hostInstagram.replace(/^@?/, '@').replace('@@', '@'),
    baggageStorage,
    notes,
    feeMode: fee.feeMode,
    feeLabelExpected: fee.feeLabelExpected,
    conditionLabelExpected: fee.conditionLabelExpected,
    additionalInfoExpected: config.additionalInfo,
    raw,
  };
}
