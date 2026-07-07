<div align="center">

# ✅ Before IG Upload

**인스타그램에 올리기 전에, 한 번 더 검수하세요.**

카드뉴스·캐러셀·캡션의 **오타 / 띄어쓰기 / 중복 표현 / 근거 기반 사실 검토**를 한 번에.
한국어 텍스트 검수에 최적화된, 벤더에 종속되지 않는 오픈 웹앱.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/keun4jang/before-ig-upload&root-directory=apps/web&project-name=before-ig-upload&repository-name=before-ig-upload)

**팀원에게 공유할 URL을 만들려면 👉 [DEPLOY.md](./DEPLOY.md)** (Vercel 몇 분 · 무료)

**SMCC 운영 검수 모드 👉 [docs/SMCC.md](./docs/SMCC.md)** · 경로 `/smcc`

</div>

---

> ⚠️ **안전 안내**: 이 앱은 **검수 보조 도구**입니다. 모든 결과는 참고용이며, 특히
> **의료·법률·금융** 정보는 절대 단정하지 않고 항상 공식 출처 재확인을 권장합니다.

## ✨ 주요 기능

| 영역 | 내용 |
| --- | --- |
| 📤 업로드 | 이미지 1~20장 드래그앤드롭 업로드, 순서 재정렬, 캡션 입력, 자동 저장 |
| 🔤 OCR | provider adapter(더미/Tesseract/Google Vision), 결과 직접 수정, 신뢰도 표시 |
| 📝 오타·문법 | 맞춤법·띄어쓰기·문장부호·어색한 표현·과장 표현·숫자/단위 표기 일관성 |
| 🔁 중복 탐지 | 완전/정규화/유사(trigram) 문장, 반복 키워드, 해시태그 중복, CTA 반복 |
| 🔎 사실 검토 | 통계·날짜·순위·의료/법률/금융 주장 추출 → **근거 기반·보수적** 검토 |
| 📊 결과 | 전체/슬라이드별 점수, 심각도 분포, 탭 필터, 수정 완료 처리, 복사 |
| 📄 내보내기 | Markdown · JSON · 인쇄용 리포트, 업로드 전 체크리스트 |
| 🎨 UX | 한국어 우선, 반응형, **다크 모드**, 단계별 로딩 UX, 데모 프로젝트 |

## 🧱 기술 스택

- **모노레포**: pnpm workspaces + Turborepo, 전면 TypeScript(strict)
- **웹**: Next.js 14 (App Router), React 18, Tailwind CSS, lucide-react, Zod
- **워커**: Node + BullMQ + Redis (선택)
- **DB**: PostgreSQL + Prisma (선택 — 기본은 in-memory 데모)
- **분석 엔진**: 외부 의존성 0의 순수 TS (`packages/shared`) — 어디서든 실행/테스트
- **Provider adapter**: OCR / LLM / Search / Storage 추상화로 **벤더 종속 최소화**

## 🚀 빠른 시작 (키·DB 없이 30초)

```bash
corepack enable          # pnpm 활성화
pnpm install
cp .env.example .env      # 기본값 DEMO_MODE=1
pnpm dev                 # http://localhost:3000
```

> 외부 API 키나 데이터베이스 없이도 **오타·중복 검사 + 전체 플로우 + 데모 프로젝트**가 즉시 동작합니다.
> `/projects/demo` 에서 샘플 결과를 바로 확인해보세요.

## 🐳 Docker 실행

```bash
# 웹만 (데모 모드, DB/Redis 불필요)
docker compose up web

# 전체 스택 (Postgres + Redis + worker)
DEMO_MODE=0 \
DATABASE_URL=postgresql://big:big@db:5432/big?schema=public \
REDIS_URL=redis://redis:6379 \
docker compose --profile full up
```

## ☁️ GitHub Codespaces

이 저장소를 Codespaces로 열면 `.devcontainer` 가 자동으로 pnpm 설치와 `.env` 준비까지 마칩니다.
터미널에서 `pnpm dev` 만 실행하세요. (포트 3000 자동 미리보기)

## ⚙️ 환경변수

`.env.example` 에 모든 항목이 주석과 함께 정리되어 있습니다. 핵심만 요약하면:

| 변수 | 기본 | 설명 |
| --- | --- | --- |
| `DEMO_MODE` | `1` | `1`=in-memory·키 불필요, `0`=DB/provider 사용 |
| `DATABASE_URL` | – | PostgreSQL 연결 (DEMO_MODE=0 시 필요) |
| `REDIS_URL` | – | BullMQ 큐 (없으면 web에서 in-process 분석으로 fallback) |
| `STORAGE_DRIVER` | `local` | `local` \| `s3` |
| `OCR_PROVIDER` | `dummy` | `dummy` \| `tesseract` \| `google` |
| `LLM_PROVIDER` | `none` | `none` \| `openai` \| `anthropic` |
| `SEARCH_PROVIDER` | `none` | `none` \| `tavily` \| `serpapi` |

### OCR provider 설정

- **dummy(기본)**: 키 불필요. 업로드 후 텍스트를 직접 입력/붙여넣기.
- **tesseract**: `pnpm add -w tesseract.js` 후 `OCR_PROVIDER=tesseract`. 로컬·무료.
- **google**: `OCR_PROVIDER=google` + `GOOGLE_VISION_API_KEY`.

### 사실 검토(fact-check) provider 설정

근거 수집(Search)과 판정 요약(LLM)을 각각 켤 수 있습니다. **둘 다 없으면** claim은 추출하되
`검토 필요`로 **보수적으로** 표시됩니다(단정 금지).

```env
SEARCH_PROVIDER=tavily   # TAVILY_API_KEY 필요
LLM_PROVIDER=openai      # OPENAI_API_KEY 필요
```

## 📦 배포

> 📖 **단계별 가이드: [DEPLOY.md](./DEPLOY.md)** — 팀원에게 공유할 공개 URL 만들기 (Vercel/Render/Railway/Fly/self-host)

`output: standalone` 과 provider adapter 구조 덕분에 **어디든** 배포 가능합니다.

- **Vercel**: `apps/web` 를 배포. 외부 Postgres(Neon/Supabase)·Redis(Upstash)·S3 연결. 워커는 별도 서비스로.
- **Railway / Render / Fly.io**: `apps/web/Dockerfile`, `apps/worker/Dockerfile` 로 각각 컨테이너 배포.
- **self-host VPS**: `docker compose --profile full up -d`.

헬스체크: `GET /api/health` (provider 구성 상태 포함).

프로덕션 DB 준비:

```bash
pnpm db:generate && pnpm db:push && pnpm db:seed
```

## 🗂 폴더 구조

```
before-ig-upload/
├─ apps/
│  ├─ web/                 # Next.js 웹앱 (UI + API route handlers)
│  │  └─ src/
│  │     ├─ app/           # 페이지 & API 라우트
│  │     ├─ components/    # UI 컴포넌트 (workspace, issue-card, uploader ...)
│  │     └─ lib/           # store · providers · services · env
│  └─ worker/              # BullMQ 분석 워커 (선택)
├─ packages/
│  ├─ shared/              # ⭐️ 분석 엔진(순수 TS) + 타입/상수/데모데이터 (+테스트)
│  ├─ ui/                  # 재사용 UI 프리미티브 (Button/Card/Badge ...)
│  └─ db/                  # Prisma 스키마 · 클라이언트 · seed
├─ .devcontainer/          # Codespaces
├─ .github/                # CI · 이슈/PR 템플릿
└─ docker-compose.yml
```

### 아키텍처 계층

```
UI (React)  →  API route handlers  →  services  →  분석 파이프라인(shared)
                                          ↘  provider adapters (OCR/LLM/Search/Storage)
                                          ↘  store (in-memory | Prisma)
```

## 🧪 개발 · 품질

```bash
pnpm dev         # 전체 개발 서버 (turbo)
pnpm test        # 단위/통합 테스트 (vitest)
pnpm typecheck   # 전체 타입 체크
pnpm lint        # ESLint
pnpm build       # 전체 빌드
```

테스트는 정규화·중복 탐지·점수 계산·claim 추출·전체 파이프라인 통합을 커버합니다.

## 🛡 사실 검토 설계 원칙

- 출처 없으면 **단정 금지** → `검토 필요`
- 출처 1건 → `근거 부족`(참고 가능 수준)
- 출처 상충 → `상충되는 정보 있음`
- 의료/법률/금융 등 **고위험** → 강한 긍정 판정을 완화하고 "원문 재확인 권장" 문구 강제
- 모든 결과에 **신뢰도**와 **출처 링크** 표시

## 🧭 확장 포인트 (다음 추천 작업)

- `apps/web/src/lib/store/prisma.ts` 로 Prisma 저장소 구현 후 팩토리에 주입 (인터페이스는 이미 준비됨)
- web → worker **큐 연동**(현재 web은 in-process 분석, worker는 독립 소비자로 준비됨)
- OCR bounding box 하이라이트, 임베딩 기반 유사도(LLM provider)
- Auth.js(GitHub 로그인) 활성화, 워크스페이스/공유
- S3 StorageProvider 실제 구현(`@aws-sdk/client-s3`)
- 분석 이력 diff 뷰, 금칙어/브랜드 톤 사전 커스터마이즈

## 📄 라이선스

[MIT](./LICENSE)
