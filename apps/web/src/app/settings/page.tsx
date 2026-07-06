import { CheckCircle2, XCircle } from 'lucide-react';
import { Badge, Card, CardContent } from '@big/ui';
import { getAppSettings, isFactCheckEnabled } from '@/lib/env';
import { SafetyNotice } from '@/components/safety-notice';

export const dynamic = 'force-dynamic';
export const metadata = { title: '설정' };

export default function SettingsPage() {
  const s = getAppSettings();
  const factCheck = isFactCheckEnabled();

  const rows: Array<{ label: string; value: string; on: boolean; hint: string }> = [
    {
      label: '실행 모드',
      value: s.demoMode ? 'DEMO (in-memory)' : 'Production (DB)',
      on: !s.demoMode,
      hint: s.demoMode
        ? '외부 키/DB 없이 동작 중입니다. 데이터는 서버 메모리에 임시 저장됩니다.'
        : 'PostgreSQL 저장소를 사용합니다.',
    },
    {
      label: 'OCR provider',
      value: s.ocrProvider,
      on: s.ocrProvider !== 'dummy',
      hint: s.ocrProvider === 'dummy' ? '데모용 더미 OCR. 텍스트를 직접 입력/붙여넣기 하세요.' : '실제 OCR 사용 중',
    },
    {
      label: 'LLM provider',
      value: s.llmProvider,
      on: s.llmProvider !== 'none',
      hint: s.llmProvider === 'none' ? '설정 시 사실 검토 요약이 향상됩니다.' : '사실 검토 요약에 사용됩니다.',
    },
    {
      label: 'Search provider',
      value: s.searchProvider,
      on: s.searchProvider !== 'none',
      hint: s.searchProvider === 'none' ? '설정 시 근거 자료를 자동 수집합니다.' : '근거 자료를 수집합니다.',
    },
    {
      label: '스토리지',
      value: s.storageDriver,
      on: true,
      hint: s.storageDriver === 'local' ? '로컬 디스크에 저장' : 'S3 호환 스토리지',
    },
    {
      label: '사실 검토 기능',
      value: factCheck ? '활성화' : '비활성화',
      on: factCheck,
      hint: factCheck
        ? '근거 기반 검토가 활성화되어 있습니다.'
        : 'LLM 또는 Search provider 키를 설정하면 활성화됩니다. 현재는 보수적으로 "검토 필요"로 표시됩니다.',
    },
  ];

  return (
    <div className="container-page max-w-3xl py-10">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">설정</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        현재 provider 구성 상태입니다. 값은 환경변수(.env)로 설정합니다.
      </p>

      <Card className="mt-6">
        <CardContent className="divide-y divide-slate-100 p-0 dark:divide-slate-800">
          {rows.map((r) => (
            <div key={r.label} className="flex items-start justify-between gap-4 p-4">
              <div>
                <div className="flex items-center gap-2">
                  {r.on ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-slate-300" />
                  )}
                  <span className="text-sm font-medium">{r.label}</span>
                </div>
                <p className="mt-1 pl-6 text-xs text-slate-500 dark:text-slate-400">{r.hint}</p>
              </div>
              <Badge tone={r.on ? 'success' : 'neutral'}>{r.value}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mt-5">
        <SafetyNotice />
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
        <p className="font-medium text-slate-700 dark:text-slate-300">provider 설정 방법</p>
        <p className="mt-1">
          루트의 <code className="rounded bg-slate-200 px-1 dark:bg-slate-800">.env.example</code> 를{' '}
          <code className="rounded bg-slate-200 px-1 dark:bg-slate-800">.env</code> 로 복사한 뒤
          OCR/LLM/Search 키를 채우고 서버를 재시작하세요. 자세한 내용은 README를 참고하세요.
        </p>
      </div>
    </div>
  );
}
