# 🚀 배포 가이드 — 팀원들에게 공유하기

이 문서는 **팀원들이 브라우저에서 접속할 수 있는 공개 URL**을 만드는 방법을 다룹니다.
가장 빠른 길은 **Vercel(무료, 몇 분)** 이고, 데이터를 영구 저장하려면 **Render/Railway/Fly** 같은
컨테이너 호스팅을 쓰면 됩니다.

> 어떤 방식이든 **키·DB 없이 데모 모드**로 먼저 띄운 뒤, 나중에 환경변수만 추가하면
> 실제 저장·OCR·사실 검토로 업그레이드할 수 있습니다.

---

## ✅ 옵션 A — Vercel (가장 쉬움 · 공유 URL 즉시 생성) ⭐️ 추천

팀원들에게 링크 하나만 보내면 되는 가장 간단한 방법입니다. 데모 모드로 바로 동작합니다.

### 방법 1) 대시보드에서 클릭 (권장)

1. https://vercel.com 로그인 (GitHub 계정)
2. **Add New → Project** → 이 저장소(`keun4jang/before-ig-upload`) Import
3. **Root Directory** 를 **`apps/web`** 로 지정 ← 모노레포라 이게 중요합니다
   - 프레임워크는 자동으로 **Next.js** 감지, 빌드/설치 명령은 `apps/web/vercel.json` 이 알아서 처리
4. (선택) 환경변수는 나중에 추가해도 됩니다 — 비워두면 데모 모드
5. **Deploy** → 1~2분 후 `https://<프로젝트>.vercel.app` 주소 생성
6. 이 URL 을 팀원에게 공유 (공개 URL이라 바로 접속 가능)

### 방법 2) 원클릭 버튼

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/keun4jang/before-ig-upload&root-directory=apps/web&project-name=before-ig-upload&repository-name=before-ig-upload)

> 버튼으로 만들 때도 Import 화면에서 **Root Directory = `apps/web`** 인지 꼭 확인하세요.

### Vercel 에서 실제 저장/사실검토까지 켜기 (선택)

Vercel 프로젝트 **Settings → Environment Variables** 에 추가 후 재배포:

| 변수 | 값 예시 | 용도 |
| --- | --- | --- |
| `DEMO_MODE` | `0` | 실제 DB 사용 |
| `DATABASE_URL` | Neon/Supabase 연결 문자열 | PostgreSQL (외부) |
| `SEARCH_PROVIDER` / `TAVILY_API_KEY` | `tavily` / `key` | 근거 자료 수집 |
| `LLM_PROVIDER` / `OPENAI_API_KEY` | `openai` / `key` | 사실 검토 요약 |

- **Postgres**: [Neon](https://neon.tech) 또는 [Supabase](https://supabase.com) 무료 티어 → `DATABASE_URL` 복사
- 최초 1회 스키마 반영: 로컬에서 `DATABASE_URL=... pnpm db:push && DATABASE_URL=... pnpm db:seed`
- Vercel 은 서버리스라 **워커(큐)는 실행하지 않습니다.** 웹앱은 워커 없이 in-process 로 분석하므로 문제없습니다.

---

## ✅ 옵션 B — Render (전체 스택 · 영구 저장 · 워커 포함)

저장소에 포함된 **`render.yaml` Blueprint** 로 web + worker + Postgres + Redis 를 한 번에 띄웁니다.

1. https://render.com 로그인
2. **New → Blueprint** → 이 저장소 선택
3. Render 가 `render.yaml` 을 읽어 4개 리소스를 자동 생성
4. 배포 후 `big-web` 서비스의 URL 을 `NEXT_PUBLIC_APP_URL` 환경변수에 넣고 재배포
5. DB 스키마 반영: Render Shell 또는 로컬에서 `DATABASE_URL=... pnpm db:push`

---

## ✅ 옵션 C — Railway

1. https://railway.app → **New Project → Deploy from GitHub repo**
2. 서비스 2개 생성:
   - **web**: Dockerfile 경로 `apps/web/Dockerfile`
   - **worker**: Dockerfile 경로 `apps/worker/Dockerfile`
3. 플러그인으로 **PostgreSQL**, **Redis** 추가 → 자동 주입되는 `DATABASE_URL`, `REDIS_URL` 사용
4. web 서비스에 `DEMO_MODE=0`, `NEXT_PUBLIC_APP_URL=<배포 URL>` 설정
5. web 서비스에 도메인 생성 → 팀 공유

---

## ✅ 옵션 D — Fly.io

```bash
fly launch --dockerfile apps/web/Dockerfile --no-deploy   # web
fly postgres create && fly redis create                   # 매니지드 DB/Redis
fly secrets set DEMO_MODE=0 DATABASE_URL=... REDIS_URL=...
fly deploy
# 워커는 별도 앱으로: fly launch --dockerfile apps/worker/Dockerfile
```

---

## ✅ 옵션 E — self-host (VPS / 사내 서버)

```bash
git clone <repo> && cd before-ig-upload
# 전체 스택 (Postgres + Redis + worker)
DEMO_MODE=0 \
DATABASE_URL=postgresql://big:big@db:5432/big?schema=public \
REDIS_URL=redis://redis:6379 \
docker compose --profile full up -d

# 데모만 (DB/Redis 불필요)
docker compose up -d web
```

리버스 프록시(Nginx/Caddy)로 도메인을 붙이면 팀 내부에서 접속할 수 있습니다.

---

## 🔍 배포 후 확인

- 헬스체크: `GET https://<도메인>/api/health` → provider 구성 상태 JSON
- 데모 확인: `https://<도메인>/projects/demo` → **검수 시작**

## 🔐 팀 공유 시 참고

- Vercel/Render 의 기본 URL 은 **링크를 아는 사람은 접속 가능**합니다(공개).
- 접근 제한이 필요하면: Vercel의 **Password Protection**(Pro), 또는 리버스 프록시 인증,
  또는 `.env` 의 `AUTH_ENABLED=true` + GitHub 로그인(Auth.js) 연동을 활성화하세요.
- 이 앱은 **검수 보조 도구**입니다. 결과는 참고용이며, 의료·법률·금융 정보는 공식 출처 재확인을 권장합니다.
