import Link from 'next/link';
import {
  ArrowRight,
  Copy,
  FileSearch,
  Layers,
  ScanText,
  ShieldCheck,
  SpellCheck2,
  Sparkles,
} from 'lucide-react';
import { Badge, Button, Card, CardContent } from '@big/ui';
import { SafetyNotice } from '@/components/safety-notice';

const CORE_VALUES = [
  {
    icon: SpellCheck2,
    title: '오타 · 띄어쓰기 점검',
    desc: '맞춤법, 띄어쓰기, 어색한 표현, 문장부호까지 한국어에 맞춰 꼼꼼하게 확인합니다.',
  },
  {
    icon: Layers,
    title: '슬라이드 중복 탐지',
    desc: '슬라이드 간 중복 문장과 유사 표현, 반복 키워드, 해시태그 중복을 찾아냅니다.',
  },
  {
    icon: FileSearch,
    title: '근거 기반 사실 검토',
    desc: '숫자·통계·날짜·의료/법률/금융 주장을 추출해 근거와 함께 신중하게 검토합니다.',
  },
] as const;

const STEPS = [
  { icon: ScanText, title: '1. 업로드', desc: '카드뉴스 이미지와 캡션을 올립니다.' },
  { icon: Sparkles, title: '2. 검수', desc: 'OCR → 오타 → 중복 → 사실 검토를 자동 실행합니다.' },
  { icon: Copy, title: '3. 수정 & 복사', desc: '제안 문구를 확인하고 바로 복사해 업로드하세요.' },
] as const;

const FAQ = [
  {
    q: 'API 키가 없어도 사용할 수 있나요?',
    a: '네. 기본 데모 모드에서는 외부 키나 데이터베이스 없이도 오타·중복 검사와 전체 플로우를 체험할 수 있습니다. OCR/사실 검토 provider는 키를 넣으면 자동으로 활성화됩니다.',
  },
  {
    q: '사실 검토 결과를 그대로 믿어도 되나요?',
    a: '아니요. 모든 결과는 참고용입니다. 특히 의료·법률·금융 정보는 단정하지 않으며, 항상 공식 출처 재확인을 권장합니다.',
  },
  {
    q: '어떤 이미지 형식을 지원하나요?',
    a: 'JPG, PNG, WebP를 우선 지원합니다. 한 프로젝트에 최대 20장까지 올릴 수 있습니다.',
  },
  {
    q: '내 데이터는 어디에 저장되나요?',
    a: '데모 모드는 서버 메모리에만 임시 저장됩니다. 프로덕션에서는 PostgreSQL과 원하는 스토리지(provider adapter)로 직접 운영할 수 있습니다.',
  },
] as const;

export default function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-brand-50/70 to-transparent dark:from-brand-950/30" />
        <div className="container-page py-16 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Badge tone="brand" className="mb-5">
              <Sparkles className="h-3.5 w-3.5" /> 인스타 업로드 전, 마지막 관문
            </Badge>
            <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-slate-50 sm:text-5xl">
              인스타 업로드 전에,
              <br />
              <span className="text-brand-600">한 번 더 검수하세요.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-slate-600 dark:text-slate-300">
              오타보다 더 무서운 건, 틀린 정보입니다. 카드뉴스와 캡션의 오타·중복 문장·애매한
              표현부터 근거가 필요한 주장까지 한 번에 점검합니다.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/projects/new">
                <Button size="lg" className="w-full sm:w-auto">
                  검수 시작하기 <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/projects/demo">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  데모 프로젝트 보기
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              키·설치 없이 데모 모드로 바로 체험할 수 있어요.
            </p>
          </div>

          {/* 데모 스크린샷 영역 */}
          <div className="mx-auto mt-14 max-w-4xl">
            <div className="rounded-3xl border border-slate-200 bg-white p-2 shadow-xl shadow-brand-600/5 dark:border-slate-800 dark:bg-slate-900">
              <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-brand-50/60 p-6 dark:from-slate-950 dark:to-brand-950/20">
                <div className="grid gap-4 sm:grid-cols-3">
                  <MockScore />
                  <MockIssues />
                  <MockChecklist />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core values */}
      <section className="container-page py-16">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          업로드 전에 확인해야 할 세 가지
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {CORE_VALUES.map((v) => (
            <Card key={v.title} className="animate-fade-in">
              <CardContent className="pt-6">
                <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950">
                  <v.icon className="h-6 w-6" />
                </span>
                <h3 className="text-lg font-semibold">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {v.desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="border-y border-slate-200/70 bg-white py-16 dark:border-slate-800/70 dark:bg-slate-900/40">
        <div className="container-page">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            3단계면 충분합니다
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.title} className="flex flex-col items-center text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white">
                  <s.icon className="h-7 w-7" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container-page py-16">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">자주 묻는 질문</h2>
        <div className="mx-auto mt-8 max-w-3xl divide-y divide-slate-200 dark:divide-slate-800">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-slate-800 dark:text-slate-200">
                {f.q}
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mx-auto mt-8 max-w-3xl">
          <SafetyNotice />
        </div>
      </section>

      {/* CTA */}
      <section className="container-page pb-20">
        <div className="rounded-3xl bg-brand-600 px-6 py-12 text-center text-white sm:py-16">
          <ShieldCheck className="mx-auto mb-4 h-10 w-10" />
          <h2 className="text-2xl font-bold sm:text-3xl">올리기 전에, 한 번 더 확인해보세요.</h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-100">
            중복 문장과 애매한 표현, 근거가 필요한 주장까지 한 번에 점검합니다.
          </p>
          <Link href="/projects/new" className="mt-7 inline-block">
            <Button size="lg" variant="secondary">
              무료로 검수 시작 <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

function MockScore() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
      <div className="text-4xl font-extrabold text-amber-600">72</div>
      <div className="text-xs text-slate-500">검토 권장</div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full w-[72%] rounded-full bg-amber-500" />
      </div>
    </div>
  );
}

function MockIssues() {
  return (
    <div className="space-y-2 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
      {[
        ['오타', '"되요" → "돼요"'],
        ['중복', '슬라이드 3 반복 문장'],
        ['사실', '"30% 상승" 근거 필요'],
      ].map(([tag, txt]) => (
        <div key={txt} className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300">
            {tag}
          </span>
          <span className="text-slate-600 dark:text-slate-300">{txt}</span>
        </div>
      ))}
    </div>
  );
}

function MockChecklist() {
  return (
    <div className="space-y-2 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
      {['오타 확인', '중복 확인', '사실 근거 확인', '캡션 확인'].map((t, i) => (
        <div key={t} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <span className={i < 2 ? 'text-emerald-500' : 'text-slate-300'}>
            {i < 2 ? '✅' : '⬜️'}
          </span>
          {t}
        </div>
      ))}
    </div>
  );
}
