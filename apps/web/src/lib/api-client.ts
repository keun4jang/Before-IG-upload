'use client';

import type { AnalysisRun, CaptionDraft, Project } from '@big/shared';
import type { ProjectDetail } from './store/types';

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let message = `요청 실패 (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {}
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export const api = {
  listProjects: () => req<{ projects: Project[] }>('/api/projects'),
  getProject: (id: string) => req<ProjectDetail>(`/api/projects/${id}`),
  createProject: (body: { name: string; description?: string; notes?: string }) =>
    req<{ project: Project }>('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
  updateProject: (id: string, patch: Partial<Project>) =>
    req<{ project: Project }>(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteProject: (id: string) =>
    req<{ deleted: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),

  addAssets: (
    id: string,
    assets: Array<{
      fileName: string;
      mimeType: string;
      previewUrl?: string;
      width?: number;
      height?: number;
      sizeBytes?: number;
      seedText?: string;
    }>,
  ) =>
    req<{ assets: unknown[] }>(`/api/projects/${id}/assets`, {
      method: 'POST',
      body: JSON.stringify({ assets }),
    }),
  removeAsset: (id: string, assetId: string) =>
    req<{ deleted: boolean }>(`/api/projects/${id}/assets/${assetId}`, { method: 'DELETE' }),
  reorder: (id: string, orderedAssetIds: string[]) =>
    req<{ reordered: boolean }>(`/api/projects/${id}/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ orderedAssetIds }),
    }),
  updateSlide: (id: string, slideNumber: number, editedText: string) =>
    req<{ updated: boolean }>(`/api/projects/${id}/slides/${slideNumber}`, {
      method: 'PATCH',
      body: JSON.stringify({ editedText }),
    }),
  updateCaption: (id: string, patch: Partial<CaptionDraft>) =>
    req<{ caption: CaptionDraft }>(`/api/projects/${id}/caption`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  runAnalysis: (projectId: string) =>
    req<{ run: AnalysisRun }>('/api/analysis/run', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    }),
  getRun: (runId: string) => req<{ run: AnalysisRun }>(`/api/analysis/${runId}`),
  toggleIssue: (issueId: string, runId: string, resolved: boolean) =>
    req<{ run: AnalysisRun }>(`/api/issues/${issueId}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify({ runId, resolved }),
    }),
};
