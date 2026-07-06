/**
 * Provider adapter 인터페이스 (계약만 정의, 구현은 app/worker에서).
 * 벤더 종속을 피하고 graceful degradation을 가능하게 하는 핵심 추상화.
 */
import type { EvidenceSource, TextBlock } from './types';
import type { LlmVerdict } from './analysis/claims';

export interface OcrResult {
  text: string;
  confidence: number; // 0~1
  blocks: TextBlock[];
}

export interface OcrProvider {
  readonly name: string;
  /** 이미지 바이트(또는 data URL)에서 텍스트 추출 */
  recognize(image: OcrImage): Promise<OcrResult>;
}

export interface OcrImage {
  /** 바이너리 데이터 (Buffer/Uint8Array) 또는 data URL 문자열 */
  data: Uint8Array | string;
  mimeType: string;
  fileName?: string;
}

export interface SearchProvider {
  readonly name: string;
  search(query: string, limit?: number): Promise<EvidenceSource[]>;
}

export interface LlmProvider {
  readonly name: string;
  /** 근거 기반 사실 검토 요약 */
  verifyClaim(claim: string, sources: EvidenceSource[]): Promise<LlmVerdict>;
  /** (선택) 임베딩 기반 유사도 등 확장용 */
  embed?(texts: string[]): Promise<number[][]>;
}

export interface StoredObject {
  key: string;
  url: string;
  sizeBytes: number;
}

export interface StorageProvider {
  readonly name: string;
  put(key: string, data: Uint8Array, contentType: string): Promise<StoredObject>;
  getUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}
