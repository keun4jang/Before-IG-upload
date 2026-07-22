import { CONDITION_LABEL, LANGUAGE_LABEL } from '../constants';
import { PROGRAM_CONFIG } from '../program-config';
import type { FeeMode, LanguageMode, NormalizedEvent, ProgramType } from '../schemas';
import { cell, pickIndex } from '../csv';
import { formatDateEn, formatDateKr, parseDate, weekdayOf } from '../formatters/date';
import { addMinutes, formatTimeLabel, parseTime } from '../formatters/time';
import { canonLocation, parseDistance, parseRoute, type NormalizeMeta } from './base';

/** Program 열 값("데일리 커피 챗"/"Coffee Chat"/"에스프레소 런"...) → 프로그램 타입 */
function parseProgram(raw: string): ProgramType {
  const n = raw.toLowerCase();
  if (n.includes('에스프레소') || n.includes('espresso')) return 'espresso-run';
  if (n.includes('북') || n.includes('book')) return 'book-dive';
  if (n.includes('레이브') || n.includes('rave')) return 'rave';
  if (n.includes('글로우') || n.includes('glow')) return 'glow-up';
  return 'daily-coffee-chat';
}

/**
 * 통합본(Weekly Announcement Master · "Weekly Production" 탭) 정규화.
 * 다른 시트들과 달리 행마다 Program / Language / Price 가 명시돼 있어서, 규칙으로 유추하지
 * 않고 시트에 적힌 값을 그대로 정답으로 쓴다(가격은 행사마다 달라 시트가 기준).
 */
export function normalizeMaster(
  headers: string[],
  row: string[],
  meta: NormalizeMeta,
): NormalizedEvent {
  const get = (keys: string[], exclude: string[] = []) => cell(row, pickIndex(headers, keys, exclude));

  const dateRaw = get(['date', '날짜'], ['sort']);
  const timeRaw = get(['time', '시간'], ['sort', 'duration']);
  const durationRaw = get(['duration']);
  const programRaw = get(['program', '프로그램']);
  const languageRaw = get(['language', '언어']);
  const hostInstagram = get(['instagram', '인스타']) || get(['host', '호스트']);
  const locationRaw = get(['city', '지역', 'region']);
  const cafeName = get(['meet point', 'meetpoint', 'cafe', '카페']);
  const priceRaw = get(['price', '가격', '참가비']);
  const cafeAddress = get(['address', '주소']);
  const routeRaw = get(['course', '코스']);
  const distanceRaw = get(['distance', '거리']);
  const notes = get(['additional', '추가']);

  const programType = parseProgram(programRaw);
  const config = PROGRAM_CONFIG[programType];
  const languageMode: LanguageMode = /english/i.test(languageRaw) ? 'EN' : 'KR';

  const pd = parseDate(dateRaw, meta.refDate ?? new Date());
  const dateIso = pd.iso;
  const weekdayExpected = dateIso ? weekdayOf(dateIso) : null;

  const startTime24h = parseTime(timeRaw);
  const endTimeDerived24h = startTime24h ? addMinutes(startTime24h, config.durationMin) : null;
  const timeLabel =
    durationRaw.trim() ||
    (startTime24h && endTimeDerived24h ? formatTimeLabel(startTime24h, endTimeDerived24h) : '');

  const loc = canonLocation(locationRaw);
  const routeStops = parseRoute(routeRaw);
  const distanceKm = parseDistance(distanceRaw);

  // 가격: 시트의 Price 열이 정답. 금액(원/$)이면 유료, "1인 1잔"/"Min. 1 Drink" 등은 무료 조건.
  const isPaid = /\d\s*원|\$\s*\d|\d\s*달러/.test(priceRaw);
  const feeMode: FeeMode = isPaid ? 'paid' : 'free';
  const feeLabelExpected = priceRaw.trim() || (isPaid ? '' : CONDITION_LABEL[languageMode]);
  const conditionLabelExpected = isPaid ? '' : priceRaw.trim() || CONDITION_LABEL[languageMode];

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
    weekdayRaw: dateRaw,
    dateLabelKr: dateIso ? formatDateKr(dateIso) : '',
    dateLabelEn: dateIso ? formatDateEn(dateIso) : '',
    startTimeRaw: timeRaw,
    startTime24h,
    endTimeDerived24h,
    timeLabel,
    meetupSpotName: programType === 'espresso-run' ? cafeName : '',
    meetupSpotAddress: '',
    cafeName,
    cafeBranch: '',
    cafeAddress,
    routeRaw,
    routeStops,
    distanceKm,
    estimatedPace: '',
    hostInstagram: hostInstagram ? hostInstagram.replace(/^@?/, '@').replace('@@', '@') : '',
    baggageStorage: '',
    notes,
    feeMode,
    feeLabelExpected,
    conditionLabelExpected,
    additionalInfoExpected: config.additionalInfo,
    raw,
  };
}
