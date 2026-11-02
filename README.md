# imagen-local

Hugging Face 오픈 웨이트 이미지 모델을 빌린 GPU 에 올려 쓰는 채팅형 웹앱이다. 프론트와 API 를 Next.js 하나에 두고, GPU 추론은 `gpu/` 의 Python 워커가 맡는다.

## 시작

```bash
cp .env.example .env
npm install          # postinstall 이 Prisma 클라이언트도 생성한다
npm run db:migrate   # dev.db 생성, 마이그레이션 적용
npm run dev          # http://localhost:3000
```

## 명령

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 (Turbopack) |
| `npm run build`, `npm start` | 프로덕션 빌드, 실행 |
| `npm run lint` | ESLint. Next 규칙 + TanStack Query 규칙 |
| `npm run typecheck` | 라우트 타입 생성 후 `tsc --noEmit` |
| `npm run db:migrate -- --name <이름>` | 스키마 변경을 마이그레이션으로 만들고 적용 |
| `npm run db:generate` | Prisma 클라이언트 재생성. Prisma 7 의 migrate 는 클라이언트를 생성하지 않으므로 migrate 뒤에 돌린다 |
| `npm run db:studio` | DB 내용 보기 |

테스트는 작업공간 루트의 `tests/` 에서 관리한다. 이 앱 폴더에는 테스트 코드와 설정을 두지 않는다.

## 구조

코드가 아직 없는 폴더는 비어 있다.

```
imagen-local/
├── prisma/
│   ├── schema.prisma          # User, Conversation, Job
│   └── migrations/
├── prisma7.config.ts          # Prisma CLI 설정 (Prisma 7.10 의 파일 이름)
├── src/
│   ├── app/
│   │   ├── layout.tsx         # 폰트, Providers
│   │   ├── page.tsx           # 새 채팅
│   │   ├── c/[id]/            # 대화별 화면
│   │   └── api/
│   │       └── jobs/[id]/     # GET 상태(워커 폴링 동기화)·DELETE 취소
│   ├── components/
│   │   ├── providers.tsx      # React Query, 테마, 툴팁, 토스트
│   │   ├── ui/                # shadcn 생성물
│   │   ├── chat/              # 메시지 목록, 프롬프트 입력, 모델 선택
│   │   └── gallery/
│   ├── hooks/
│   ├── lib/
│   │   ├── db.ts              # Prisma 클라이언트 (better-sqlite3 어댑터)
│   │   ├── utils.ts           # cn()
│   │   ├── storage/           # 이미지 저장. 로컬 파일 → S3 로 바꾸는 자리
│   │   ├── gpu/               # config.ts 에 GPU 종류·개수. 모델 목록, GPU 서버 호출
│   │   └── jobs/              # 생성 요청 만들기·조회
│   └── generated/prisma/      # prisma generate 결과물. git 에 올리지 않는다
├── gpu/                       # Modal GPU 워커(Python), workflows/ 에 ComfyUI API 포맷 워크플로
├── docs/                      # 모델 리서치
└── public/
```

## 설정 메모

- **Cache Components 가 켜져 있다.** Next 16 템플릿 기본값이다. DB 조회처럼 요청 때마다 달라지는 데이터를 읽는 규칙은 `AGENTS.md` 가 가리키는 `node_modules/next/dist/docs/` 를 따른다.
- **`turbopack.root` 를 이 폴더로 고정했다.** 상위 작업공간에도 `package-lock.json` 이 있어 자동 감지가 그쪽을 루트로 잡는다.
- **shadcn 은 Base UI 기반 `base-nova` 스타일이다.** `cn()` 은 shadcn 이 관리하는 `cn` 패키지에서 온다.
- **색·반경·그림자·글자 스타일은 디자인 시스템 토큰이다.** `src/app/globals.css` 의 shadcn 변수에 연결돼 있고, 디자인 시스템 링크는 `CLAUDE.md` 에 있다.
- **글꼴은 Inter 와 Pretendard 다.** Inter 는 `next/font/google`, Pretendard 는 `src/app/fonts/` 의 가변 글꼴을 `next/font/local` 로 불러온다. Pretendard 는 SIL OFL 1.1 이고 원문을 같은 폴더에 둔다.
- **`src/hooks/use-mobile.ts` 는 shadcn 원본과 다르다.** `useSyncExternalStore` 로 구현돼 lint 를 통과하므로 `shadcn add --overwrite` 로 덮지 않는다.
- **npm 설치 스크립트 승인.** `package.json` 의 `allowScripts` 에 better-sqlite3(네이티브 바인딩), prisma, @prisma/engines(스키마 엔진)가 버전 고정으로 들어 있다. 이 패키지를 올리면 `npm install-scripts approve <패키지>` 로 다시 승인한다.
- **SQLite 파일은 앱 폴더의 `dev.db` 다.** Prisma CLI 와 앱이 같은 `DATABASE_URL` 로 같은 파일을 쓴다.
- **GPU 종류·개수는 `.env` 의 `GPU_TYPE`, `GPU_COUNT` 로 정한다.** 없거나 비어 있으면 H100 1대다. GPU 서버 주소와 토큰은 `GPU_API_URL`, `GPU_API_TOKEN` 이다.
- **Modal 계정은 `.env` 의 `MODAL_PROFILE`, `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET` 이다.** Modal 이 읽는 공식 이름이지만 Modal 은 `.env` 파일을 직접 읽지 않는다. modal 명령 전에 `set -a; source .env; set +a` 로 셸에 불러온다.

## 최신이 아닌 버전

| 패키지 | 버전 | 이유 |
|---|---|---|
| prisma, @prisma/client | 7.x | Prisma 8 은 RC 이고 SQLite 지원이 experimental 이다. npm `latest` 태그가 8 RC 라서 `@latest` 로 설치하지 않는다 |
| eslint | 9.x | eslint-config-next 가 쓰는 react·import·jsx-a11y 플러그인이 ESLint 10 을 지원하지 않는다 |
| typescript | 5.x | create-next-app 기본값이다. 7.x 는 typescript-eslint 가 지원하지 않는다 |
| react, react-dom | 19.3.0 | Next 16.4.3 템플릿 고정값이다 |
