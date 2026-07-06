import { notFound } from 'next/navigation';
import { getStore } from '@/lib/store';
import { Workspace } from '@/components/workspace';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }) {
  const detail = await getStore().getProject(params.id);
  return { title: detail?.project.name ?? '프로젝트' };
}

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const detail = await getStore().getProject(params.id);
  if (!detail) notFound();
  return <Workspace initial={detail} />;
}
