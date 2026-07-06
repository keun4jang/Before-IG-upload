import Link from 'next/link';
import { Plus, FolderOpen } from 'lucide-react';
import { Button } from '@big/ui';
import { getStore } from '@/lib/store';
import { ProjectCard } from '@/components/project-card';

export const dynamic = 'force-dynamic';
export const metadata = { title: '대시보드' };

export default async function DashboardPage() {
  const projects = await getStore().listProjects();

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

      {projects.length === 0 ? (
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
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
