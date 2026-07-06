'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button, Card, CardContent } from '@big/ui';
import { api } from '@/lib/api-client';

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('프로젝트 이름을 입력하세요.');
      return;
    }
    setLoading(true);
    try {
      const { project } = await api.createProject({
        name: name.trim(),
        description: description.trim(),
        notes: notes.trim(),
      });
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '생성에 실패했습니다.');
      setLoading(false);
    }
  }

  return (
    <div className="container-page max-w-2xl py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" /> 대시보드
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">새 프로젝트</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        검수할 카드뉴스의 기본 정보를 입력하세요. 이미지는 다음 화면에서 올립니다.
      </p>

      <Card className="mt-6">
        <CardContent className="pt-6">
          <form onSubmit={onSubmit} className="space-y-5">
            <Field label="프로젝트 이름" required>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 8월 건강 정보 카드뉴스"
                className={inputCls}
                maxLength={120}
              />
            </Field>
            <Field label="설명" hint="선택">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="이 콘텐츠에 대한 간단한 설명"
                className={inputCls}
                maxLength={500}
              />
            </Field>
            <Field label="메모" hint="선택">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="검수 시 참고할 메모 (톤, 주의사항 등)"
                className={`${inputCls} min-h-[90px] resize-y`}
                maxLength={2000}
              />
            </Field>

            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Link href="/dashboard">
                <Button type="button" variant="outline">
                  취소
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                프로젝트 만들기
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-950';

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {required && <span className="text-rose-500">*</span>}
        {hint && <span className="text-xs font-normal text-slate-400">({hint})</span>}
      </span>
      {children}
    </label>
  );
}
