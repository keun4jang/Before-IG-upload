import type {
  AnalysisRun,
  Asset,
  CaptionDraft,
  Project,
  Slide,
} from '@big/shared';

export interface ProjectDetail {
  project: Project;
  assets: Asset[];
  slides: Slide[];
  caption: CaptionDraft | null;
  runs: AnalysisRun[];
  latestRun: AnalysisRun | null;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  notes?: string;
}

export interface NewAssetInput {
  fileName: string;
  mimeType: string;
  previewUrl?: string;
  storageKey?: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
  /** OCR 전 임시 텍스트 (데모/붙여넣기용, 선택) */
  seedText?: string;
}

export interface Store {
  listProjects(): Promise<Project[]>;
  getProject(id: string): Promise<ProjectDetail | null>;
  createProject(input: CreateProjectInput): Promise<Project>;
  updateProject(
    id: string,
    patch: Partial<Pick<Project, 'name' | 'description' | 'notes' | 'status'>>,
  ): Promise<Project | null>;
  deleteProject(id: string): Promise<void>;

  addAssets(projectId: string, assets: NewAssetInput[]): Promise<Asset[]>;
  reorderAssets(projectId: string, orderedAssetIds: string[]): Promise<void>;
  removeAsset(projectId: string, assetId: string): Promise<void>;

  updateSlideText(projectId: string, slideNumber: number, editedText: string): Promise<void>;
  setSlideOcr(
    projectId: string,
    slideNumber: number,
    data: { rawText: string; confidence: number },
  ): Promise<void>;
  upsertCaption(projectId: string, patch: Partial<CaptionDraft>): Promise<CaptionDraft>;

  createRun(projectId: string): Promise<AnalysisRun>;
  getRun(runId: string): Promise<AnalysisRun | null>;
  updateRun(runId: string, patch: Partial<AnalysisRun>): Promise<AnalysisRun | null>;
  listRuns(projectId: string): Promise<AnalysisRun[]>;
  toggleIssue(runId: string, issueId: string, resolved: boolean): Promise<AnalysisRun | null>;
}
