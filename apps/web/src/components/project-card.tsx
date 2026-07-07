'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Trash2, ImageIcon } from 'lucide-react';
import type { Project, ProjectStatus } from '@big/shared';
import { Badge, Button, Card, CardContent } from '@big/ui';
import { relativeTime } from '@/lib/format';

const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: '작성 중',
  analyzing: '분석 중',
  analyzed: '검수 완료',
  archived: '보관됨',
};

const STATUS_TONE = {
  draft: 'neutral',
  analyzing: 'warning',
  analyzed: 'success',
  archived: 'neutral',
} as const;

export function ProjectCard({
  project,
  onDelete,
}: {
  project: Project;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm(`"${project.name}" 프로젝트를 삭제할까요?`)) return;
    setDeleting(true);
    onDelete(project.id);
  }

  return (
    <Link href={`/projects/${project.id}`} className="group block">
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="flex h-full flex-col gap-3 pt-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950">
              <ImageIcon className="h-5 w-5" />
            </div>
            <Badge tone={STATUS_TONE[project.status]}>{STATUS_LABEL[project.status]}</Badge>
          </div>
          <div className="flex-1">
            <h3 className="line-clamp-1 font-semibold text-slate-900 group-hover:text-brand-600 dark:text-slate-100">
              {project.name}
            </h3>
            {project.description && (
              <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                {project.description}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-400">{relativeTime(project.updatedAt)}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              disabled={deleting}
              aria-label="프로젝트 삭제"
              className="text-slate-400 hover:text-rose-600"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
