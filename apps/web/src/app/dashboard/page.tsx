'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, FolderOpen, Loader2 } from 'lucide-react';
import type { Project } from '@big/shared';
import { Button } from '@big/ui';
import { api } from '@/lib/api-client';
import { deleteLocalProject, listLocalProjects } from '@/lib/local-projects';
import { ProjectCard } from '@/components/project-card';

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const local = listLocalProjects();
      let remote: Project[] = [];
      try {
        remote = (await api.listProjects()).projects;
      } catch {
        /* 서버 목록 실패는 무시 — 로컬 목록만으로도 동작 */
      }
      if (!alive) return;
      const merged = new Map<string, Project>();
      for (const p of remote) merged.set(p.id, p);
      for (const p of local) merged.set(p.id, p); // 로컬이 최신/신뢰 가능하므로 우선
      setProjects([...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    })();
    return () => {
      alive = false;
    };
  }, []);

  function handleDelete(id: string) {
    deleteLocalProject(id);
    api.deleteProject(id).catch(() => {});
    setProjects((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
  }

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">내 프로젝트</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            검수할 카드뉴스 프로젝트를 관리하세요.
          </p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="h-4 w-4" /> 새 프로젝트
          </Button>
        </Link>
      </div>

      {projects === null ? (
        <div className="mt-16 flex justify-center text-slate-300">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="mt-16 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-20 text-center dark:border-slate-700">
          <FolderOpen className="h-10 w-10 text-slate-300" />
          <p className="mt-4 font-medium text-slate-700 dark:text-slate-300">
            아직 프로젝트가 없어요
          </p>
          <p className="mt-1 text-sm text-slate-500">첫 카드뉴스를 올리고 검수를 시작해보세요.</p>
          <Link href="/projects/new" className="mt-6">
            <Button>
              <Plus className="h-4 w-4" /> 프로젝트 만들기
            </Button>
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
