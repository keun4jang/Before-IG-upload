/**
 * 시트 없이 "카드 텍스트만"으로 검수.
 *
 * 시트 행을 고르지 않고 이미지(OCR)/붙여넣기만으로도, 카드 자체 규칙 위반
 * (언어 표기·영어/한글 라벨·금지표현·통화-지역·요일버튼·지역↔주소·요일 등)을 잡는다.
 * 프로그램/언어/지역/날짜는 카드 텍스트에서 추론한다.
 */
import { LANGUAGE_LABEL, LOCATIONS, WEEKDAY_KR } from '../constants';
import { PROGRAM_CONFIG } from '../program-config';
import type { LanguageMode, NormalizedEvent, ProgramType, RouteStop, SmccIssue } from '../schemas';
import { formatDateEn, formatDateKr, parseDate, weekdayOf } from '../formatters/date';
import { addMinutes, formatTimeLabel, parseTime } from '../formatters/time';
import { resolveFee } from '../formatters/labels';
import { withIds } from './validate-event';
import { checkCurrencyRegion, scanBadCurrency, scanForbiddenCondition } from '../validators/fee';
import { validateCardLabels, validateCardLanguage, validateLanguageLabel } from '../validators/language';
import { validateEventDate } from '../validators/date';
import {
  validateAddressRegion,
  validateRouteEndpoints,
  validateWeekdayButton,
} from '../validators/consistency';
import type { RawSmccIssue } from '../schemas';

const PROGRAM_NAMES: Array<{ type: ProgramType; kr: string; en: string }> = [
  { type: 'espresso-run', kr: '에스프레소 런', en: 'Espresso Run' },
  { type: 'book-dive', kr: '북 다이브', en: 'Book Dive' },
  { type: 'daily-coffee-chat', kr: '데일리 커피 챗', en: 'Daily Coffee Chat' },
  { type: 'rave', kr: '레이브', en: 'Rave' },
  { type: 'glow-up', kr: '글로우 업', en: 'Glow Up' },
];

function normLoose(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '');
}

export interface StandaloneInference {
  programType: ProgramType;
  languageMode: LanguageMode;
  location: string;
  dateRaw: string;
}

/** 카드 텍스트에서 프로그램/언어/지역/날짜를 추론해 최소 NormalizedEvent 구성. */
export function inferEventFromCard(cardText: string): NormalizedEvent {
  const loose = normLoose(cardText);

  // 프로그램 추론 (KR 이름 우선, 없으면 EN 이름)
  let programType: ProgramType = 'daily-coffee-chat';
  let krNameHit = false;
  let enNameHit = false;
  for (const p of PROGRAM_NAMES) {
    if (loose.includes(normLoose(p.kr))) {
      programType = p.type;
      krNameHit = true;
      break;
    }
  }
  if (!krNameHit) {
    for (const p of PROGRAM_NAMES) {
      if (loose.includes(normLoose(p.en))) {
        programType = p.type;
        enNameHit = true;
        break;
      }
    }
  }
  const config = PROGRAM_CONFIG[programType];

  // 언어 추론: 프로그램명 언어가 가장 강한 신호. 없으면 한글/영문 비중.
  let languageMode: LanguageMode;
  if (krNameHit) languageMode = 'KR';
  else if (enNameHit) languageMode = 'EN';
  else {
    const hangul = (cardText.match(/[가-힣]/g) ?? []).length;
    const latin = (cardText.match(/[A-Za-z]/g) ?? []).length;
    languageMode = hangul >= latin ? 'KR' : 'EN';
  }

  // 지역 추론
  const locMatch = LOCATIONS.find((l) => l.match.some((m) => loose.includes(normLoose(m))));
  const locationRaw = locMatch ? locMatch.kr : '';
  const locKr = locMatch ? locMatch.kr : '';
  const locEn = locMatch ? locMatch.en : '';

  // 날짜 추론: "M월 D일 요일" 또는 "Mon Dth" 형태를 원문에서 찾음
  const krDate = cardText.match(/\d{1,2}\s*월\s*\d{1,2}\s*일(?:\s*[월화수목금토일]요일)?/);
  const enDate = cardText.match(/\b[A-Za-z]{3,}\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*[A-Za-z]{3})?/);
  const dateRaw = (krDate?.[0] ?? enDate?.[0] ?? '').trim();
  const pd = parseDate(dateRaw, new Date());
  const dateIso = pd.iso;
  const weekdayExpected = dateIso ? weekdayOf(dateIso) : null;

  // 시간 추론
  const timeMatch = cardText.match(/AM\s?\d{1,2}:\d{2}|PM\s?\d{1,2}:\d{2}|\d{1,2}:\d{2}/i);
  const startTime24h = timeMatch ? parseTime(timeMatch[0]) : null;
  const endTimeDerived24h = startTime24h ? addMinutes(startTime24h, config.durationMin) : null;

  // 코스 추론(에스프레소)
  const routeLine = cardText.split('\n').find((l) => /→|->|➔/.test(l)) ?? '';
  const routeStops: RouteStop[] = routeLine
    ? routeLine.split(/→|->|➔/).map((s) => ({ name: s.trim() })).filter((r) => r.name)
    : [];

  const fee = resolveFee(programType, languageMode, routeStops.length || 1);

  return {
    id: 'standalone',
    sourceSheetType: 'daily-coffee-chat-kr',
    sourceSheetUrl: '',
    sourceRowIndex: -1,
    programType,
    languageMode,
    languageLabelExpected:
      config.allowAnyLanguage && languageMode === 'EN' ? 'Any language' : LANGUAGE_LABEL[languageMode],
    locationRaw,
    locationCanonicalKr: locKr,
    locationCanonicalEn: locEn,
    dateRaw,
    dateIso,
    weekdayExpected,
    weekdayRaw: dateRaw,
    dateLabelKr: dateIso ? formatDateKr(dateIso) : '',
    dateLabelEn: dateIso ? formatDateEn(dateIso) : '',
    startTimeRaw: timeMatch?.[0] ?? '',
    startTime24h,
    endTimeDerived24h,
    timeLabel: startTime24h && endTimeDerived24h ? formatTimeLabel(startTime24h, endTimeDerived24h) : '',
    meetupSpotName: '',
    meetupSpotAddress: '',
    cafeName: '',
    cafeBranch: '',
    cafeAddress: '',
    routeRaw: routeLine,
    routeStops,
    distanceKm: null,
    estimatedPace: '',
    hostInstagram: '',
    baggageStorage: '',
    notes: '',
    feeMode: fee.feeMode,
    feeLabelExpected: fee.feeLabelExpected,
    conditionLabelExpected: fee.conditionLabelExpected,
    additionalInfoExpected: config.additionalInfo,
    raw: {},
  };
}

export interface StandaloneResult {
  event: NormalizedEvent;
  issues: SmccIssue[];
}

/**
 * 카드 텍스트 단독 검수. weekdayButton(0=일~6=토) 지정 시 요일 교차검증.
 * 시트 정답이 없으므로 "값 대조(source-mismatch)"는 생략하고, 카드 자체 규칙만 검사.
 */
export function analyzeStandaloneCard(
  cardText: string,
  options: { weekdayButton?: number | null } = {},
): StandaloneResult {
  const event = inferEventFromCard(cardText);
  if (!cardText.trim() && options.weekdayButton == null) {
    return { event, issues: [] };
  }
  const raw: RawSmccIssue[] = [
    ...scanBadCurrency(cardText),
    ...scanForbiddenCondition(cardText),
    ...validateLanguageLabel(event, cardText),
    ...validateCardLabels(event, cardText),
    ...validateCardLanguage(event, cardText),
    ...(event.feeMode === 'paid' ? checkCurrencyRegion(event, cardText) : []),
    ...validateEventDate(event),
    ...validateAddressRegion(event, cardText),
    ...validateRouteEndpoints(event),
    ...validateWeekdayButton(event, options.weekdayButton),
  ];
  return { event, issues: withIds(raw, 'card') };
}

/** UI 표시용 요일 라벨 헬퍼 */
export function weekdayLabel(idx: number | null): string {
  return idx == null ? '' : `${WEEKDAY_KR[idx]}요일`;
}
