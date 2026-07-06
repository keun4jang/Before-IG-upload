/**
 * In-memory 저장소 (DEMO 기본값).
 * 서버 프로세스 수명 동안 유지됩니다. DB 없이 전체 플로우가 동작합니다.
 */
import {
  createId,
  DEMO_CAPTION,
  DEMO_META,
  DEMO_SLIDES,
  makePlaceholderImage,
  nowIso,
  type AnalysisRun,
  type Asset,
  type CaptionDraft,
  type Project,
  type Slide,
} from '@big/shared';
import type {
  CreateProjectInput,
  NewAssetInput,
  ProjectDetail,
  Store,
} from './types';

interface DB {
  projects: Map<string, Project>;
  assets: Map<string, Asset[]>; // projectId -> assets
  slides: Map<string, Slide[]>; // projectId -> slides
  captions: Map<string, CaptionDraft>; // projectId -> caption
  runs: Map<string, AnalysisRun[]>; // projectId -> runs
  runsById: Map<string, AnalysisRun>;
}

// 전역 싱글턴 (HMR 대비)
const g = globalThis as unknown as { __bigDB?: DB };
const db: DB =
  g.__bigDB ??
  (g.__bigDB = {
    projects: new Map(),
    assets: new Map(),
    slides: new Map(),
    captions: new Map(),
    runs: new Map(),
    runsById: new Map(),
  });

function seedDemo() {
  if (db.projects.size > 0) return;
  const now = nowIso();
  const project: Project = {
    id: 'demo',
    name: DEMO_META.name,
    description: DEMO_META.description,
    notes: DEMO_META.notes,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
  db.projects.set(project.id, project);

  const assets: Asset[] = [];
  const slides: Slide[] = [];
  for (const s of DEMO_SLIDES) {
    const assetId = createId('ast');
    assets.push({
      id: assetId,
      projectId: project.id,
      fileName: `slide-${s.slideNumber}.svg`,
      mimeType: 'image/svg+xml',
      storageKey: `demo/${s.slideNumber}`,
      previewUrl: makePlaceholderImage(s.slideNumber, s.title),
      width: 1080,
      height: 1080,
      sortOrder: s.slideNumber - 1,
    });
    slides.push({
      id: createId('sld'),
      projectId: project.id,
      assetId,
      slideNumber: s.slideNumber,
      ocrRawText: s.text,
      ocrEditedText: null,
      ocrConfidence: 0.9,
      textBlocks: [],
    });
  }
  db.assets.set(project.id, assets);
  db.slides.set(project.id, slides);
  db.captions.set(project.id, {
    id: createId('cap'),
    projectId: project.id,
    originalText: DEMO_CAPTION,
    editedText: null,
  });
  db.runs.set(project.id, []);
}
seedDemo();

function touch(project: Project): Project {
  project.updatedAt = nowIso();
  return project;
}

export const memoryStore: Store = {
  async listProjects() {
    return [...db.projects.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async getProject(id) {
    const project = db.projects.get(id);
    if (!project) return null;
    const assets = (db.assets.get(id) ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
    const slides = (db.slides.get(id) ?? []).slice().sort((a, b) => a.slideNumber - b.slideNumber);
    const runs = (db.runs.get(id) ?? []).slice().sort((a, b) =>
      (b.startedAt ?? '').localeCompare(a.startedAt ?? ''),
    );
    const detail: ProjectDetail = {
      project,
      assets,
      slides,
      caption: db.captions.get(id) ?? null,
      runs,
      latestRun: runs[0] ?? null,
    };
    return detail;
  },

  async createProject(input: CreateProjectInput) {
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
    db.projects.set(project.id, project);
    db.assets.set(project.id, []);
    db.slides.set(project.id, []);
    db.runs.set(project.id, []);
    return project;
  },

  async updateProject(id, patch) {
    const project = db.projects.get(id);
    if (!project) return null;
    Object.assign(project, patch);
    return touch(project);
  },

  async deleteProject(id) {
    db.projects.delete(id);
    db.assets.delete(id);
    db.slides.delete(id);
    db.captions.delete(id);
    for (const run of db.runs.get(id) ?? []) db.runsById.delete(run.id);
    db.runs.delete(id);
  },

  async addAssets(projectId, inputs: NewAssetInput[]) {
    const project = db.projects.get(projectId);
    if (!project) throw new Error('프로젝트를 찾을 수 없습니다.');
    const assets = db.assets.get(projectId) ?? [];
    const slides = db.slides.get(projectId) ?? [];
    const created: Asset[] = [];
    let order = assets.length;
    let slideNo = slides.length;
    for (const input of inputs) {
      const assetId = createId('ast');
      const asset: Asset = {
        id: assetId,
        projectId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        storageKey: input.storageKey ?? `mem/${assetId}`,
        previewUrl: input.previewUrl,
        width: input.width,
        height: input.height,
        sizeBytes: input.sizeBytes,
        sortOrder: order++,
      };
      assets.push(asset);
      created.push(asset);
      slideNo += 1;
      slides.push({
        id: createId('sld'),
        projectId,
        assetId,
        slideNumber: slideNo,
        ocrRawText: input.seedText ?? '',
        ocrEditedText: null,
        ocrConfidence: input.seedText ? 1 : null,
        textBlocks: [],
      });
    }
    db.assets.set(projectId, assets);
    db.slides.set(projectId, slides);
    touch(project);
    return created;
  },

  async reorderAssets(projectId, orderedAssetIds) {
    const assets = db.assets.get(projectId) ?? [];
    const slides = db.slides.get(projectId) ?? [];
    const indexOf = new Map(orderedAssetIds.map((id, i) => [id, i]));
    assets.sort((a, b) => (indexOf.get(a.id) ?? 0) - (indexOf.get(b.id) ?? 0));
    assets.forEach((a, i) => (a.sortOrder = i));
    // 슬라이드 번호 재배치 (asset 순서 기준)
    assets.forEach((a, i) => {
      const slide = slides.find((s) => s.assetId === a.id);
      if (slide) slide.slideNumber = i + 1;
    });
    const project = db.projects.get(projectId);
    if (project) touch(project);
  },

  async removeAsset(projectId, assetId) {
    db.assets.set(projectId, (db.assets.get(projectId) ?? []).filter((a) => a.id !== assetId));
    let slides = (db.slides.get(projectId) ?? []).filter((s) => s.assetId !== assetId);
    slides = slides.sort((a, b) => a.slideNumber - b.slideNumber);
    slides.forEach((s, i) => (s.slideNumber = i + 1));
    db.slides.set(projectId, slides);
    const project = db.projects.get(projectId);
    if (project) touch(project);
  },

  async updateSlideText(projectId, slideNumber, editedText) {
    const slide = (db.slides.get(projectId) ?? []).find((s) => s.slideNumber === slideNumber);
    if (slide) slide.ocrEditedText = editedText;
  },

  async setSlideOcr(projectId, slideNumber, data) {
    const slide = (db.slides.get(projectId) ?? []).find((s) => s.slideNumber === slideNumber);
    if (slide) {
      slide.ocrRawText = data.rawText;
      slide.ocrConfidence = data.confidence;
    }
  },

  async upsertCaption(projectId, patch) {
    const existing = db.captions.get(projectId);
    const caption: CaptionDraft = existing ?? {
      id: createId('cap'),
      projectId,
      originalText: '',
      editedText: null,
    };
    Object.assign(caption, patch);
    db.captions.set(projectId, caption);
    return caption;
  },

  async createRun(projectId) {
    const run: AnalysisRun = {
      id: createId('run'),
      projectId,
      status: 'queued',
      startedAt: nowIso(),
      finishedAt: null,
      overallScore: null,
      progress: { step: 'prepare', percent: 0, message: '대기 중' },
    };
    const runs = db.runs.get(projectId) ?? [];
    runs.push(run);
    db.runs.set(projectId, runs);
    db.runsById.set(run.id, run);
    return run;
  },

  async getRun(runId) {
    return db.runsById.get(runId) ?? null;
  },

  async updateRun(runId, patch) {
    const run = db.runsById.get(runId);
    if (!run) return null;
    Object.assign(run, patch);
    return run;
  },

  async listRuns(projectId) {
    return (db.runs.get(projectId) ?? []).slice().sort((a, b) =>
      (b.startedAt ?? '').localeCompare(a.startedAt ?? ''),
    );
  },

  async toggleIssue(runId, issueId, resolved) {
    const run = db.runsById.get(runId);
    if (!run?.result) return run ?? null;
    const issue = run.result.issues.find((i) => i.id === issueId);
    if (issue) issue.isResolved = resolved;
    // 체크리스트의 fact 항목 갱신
    const factIssues = run.result.issues.filter((i) => i.category === 'fact');
    const factItem = run.result.checklist.find((c) => c.key === 'fact');
    if (factItem) factItem.passed = factIssues.every((i) => i.isResolved);
    const ready = run.result.checklist
      .filter((c) => c.key !== 'ready')
      .every((c) => c.passed);
    const readyItem = run.result.checklist.find((c) => c.key === 'ready');
    if (readyItem) readyItem.passed = ready;
    return run;
  },
};
