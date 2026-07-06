/**
 * Storage provider 어댑터.
 * - local: 로컬 디스크(.storage). 키 불필요.
 * - s3: S3 호환 스토리지 (자격증명 필요). AWS SDK 미설치 시 안내와 함께 비활성.
 *
 * DEMO 모드에서는 미리보기를 data URL 로 처리하므로 스토리지가 필수는 아닙니다.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { StorageProvider, StoredObject } from '@big/shared';
import { env } from '../env';

const localProvider: StorageProvider = {
  name: 'local',
  async put(key, data, _contentType): Promise<StoredObject> {
    const dir = path.resolve(process.cwd(), env.localStorageDir);
    const filePath = path.join(dir, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
    return { key, url: `/_storage/${key}`, sizeBytes: data.byteLength };
  },
  async getUrl(key) {
    return `/_storage/${key}`;
  },
  async delete(key) {
    const filePath = path.join(path.resolve(process.cwd(), env.localStorageDir), key);
    await fs.rm(filePath, { force: true });
  },
};

const s3Disabled: StorageProvider = {
  name: 's3-disabled',
  async put() {
    throw new Error(
      'S3 storage 가 선택되었지만 SDK/자격증명이 없습니다. @aws-sdk/client-s3 를 설치하고 S3_* 환경변수를 설정하세요.',
    );
  },
  async getUrl(key) {
    return `/_storage/${key}`;
  },
  async delete() {},
};

export function getStorageProvider(): StorageProvider {
  if (env.storageDriver === 's3') {
    // 실제 S3 구현은 @aws-sdk/client-s3 를 여기에 연결하세요.
    return s3Disabled;
  }
  return localProvider;
}
