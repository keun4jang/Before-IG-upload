'use client';

/**
 * 브라우저(localStorage) 기반 프로젝트 저장소.
 *
 * Vercel 서버리스는 요청마다 다른 인스턴스로 뜰 수 있어 in-memory 서버 store 에만
 * 의존하면 "방금 만든 프로젝트"가 다음 요청에서 404 가 날 수 있다. 그래서 프로젝트
 * 생성/조회/목록/삭제는 브라우저에 저장하는 것을 진실의 원천으로 삼고,
 * 서버 API 호출은 있으면 좋은 best-effort(실패해도 무시)로만 시도한다.
 */
import { createId, nowIso, type Project } from '@big/shared';
import type { ProjectDetail } from './store/types';

const LIST_KEY = 'big:projects';
const detailKey = (id: string) => `big:project:${id}`;

function readList(): Project[] {
  try {
    const raw = localStorage.getItem(LIST_KEY);
    return raw ? (JSON.parse(raw) as Project[]) : [];
  } catch {
    return [];
  }
}

function writeList(list: Project[]): void {
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(list));
  } catch {
    /* 용량 초과 등은 무시 — 목록 갱신 실패는 치명적이지 않음 */
  }
}

export function listLocalProjects(): Project[] {
  return readList().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getLocalProjectDetail(id: string): ProjectDetail | null {
  try {
    const raw = localStorage.getItem(detailKey(id));
    return raw ? (JSON.parse(raw) as ProjectDetail) : null;
  } catch {
    return null;
  }
}

export function saveLocalProjectDetail(detail: ProjectDetail): void {
  // 목록(가벼움)과 상세(이미지 포함, 무거울 수 있음)를 분리 저장해
  // 상세 저장이 용량 초과로 실패해도 목록에는 반영되게 한다.
  const list = readList().filter((p) => p.id !== detail.project.id);
  list.push(detail.project);
  writeList(list);
  try {
    localStorage.setItem(detailKey(detail.project.id), JSON.stringify(detail));
  } catch {
    /* 이미지가 많아 5~10MB 용량을 넘으면 상세 저장이 실패할 수 있음(알려진 한계) */
  }
}

export function createLocalProject(input: {
  name: string;
  description?: string;
  notes?: string;
}): ProjectDetail {
  const now = nowIso();
  const project: Project = {
    id: createId('prj'),
    name: input.name,
    description: input.description ?? '',
    notes: input.notes ?? '',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
  const detail: ProjectDetail = {
    project,
    assets: [],
    slides: [],
    caption: null,
    runs: [],
    latestRun: null,
  };
  saveLocalProjectDetail(detail);
  return detail;
}

export function deleteLocalProject(id: string): void {
  try {
    localStorage.removeItem(detailKey(id));
  } catch {
    /* ignore */
  }
  writeList(readList().filter((p) => p.id !== id));
}
