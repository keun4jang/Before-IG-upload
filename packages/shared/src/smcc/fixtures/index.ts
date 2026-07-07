import type { SheetType } from '../schemas';
import { espressoRunSample } from './espresso-run.sample';
import { bookDiveSample } from './book-dive.sample';
import { dailyChatKrSample } from './daily-chat-kr.sample';
import { dailyChatEnSample } from './daily-chat-en.sample';

export { espressoRunSample, bookDiveSample, dailyChatKrSample, dailyChatEnSample };

export interface FixtureSheet {
  sheetType: SheetType;
  url: string;
  headers: string[];
  rows: string[][];
}

export const FIXTURES: Record<SheetType, FixtureSheet> = {
  'espresso-run': espressoRunSample,
  'book-dive': bookDiveSample,
  'daily-coffee-chat-kr': dailyChatKrSample,
  'daily-coffee-chat-en': dailyChatEnSample,
};
