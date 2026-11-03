# imagen-local

Hugging Face 오픈 웨이트 이미지 모델을 빌린 GPU 에 올려 쓰는 채팅형 웹앱이다. 프론트와 API 를 Next.js 하나에 두고, GPU 추론은 `gpu/` 의 Python 워커가 맡는다.

## 시작

```bash
cp .env.example .env
npm install          # postinstall 이 Prisma 클라이언트도 생성한다
npm run db:migrate   # dev.db 생성, 마이그레이션 적용
npm run dev          # http://127.0.0.1:3000
```

앱이 읽는 키:

| 키 | 뜻 |
|---|---|
| `DATABASE_URL` | SQLite 파일. 기본 `file:./dev.db` |
| `GPU_API_URL`, `GPU_API_TOKEN` | GPU 워커 주소와 Bearer 토큰. Modal 워커 값은 `gpu/configure.py` 가 `.env.local` 에 쓴다 |
| `STORAGE_DIR` | 이미지 저장 폴더. 없으면 `<앱>/storage` |
| `HF_TOKEN` | 모델을 새로 받을 때만 쓴다. `configure.py secret` 이 Modal Secret 에 넣는다 |

GPU 없이 돌리려면 작업공간 루트에서 `npm run qa:worker:mock`(8787)을 띄우고 `GPU_API_URL=http://localhost:8787`, `GPU_API_TOKEN=dev-token` 으로 둔다. `.env.local` 이 `.env` 보다 우선하므로 Modal 값이 `.env.local` 에 있으면 그쪽이 쓰인다. 테스트 명령은 작업공간 루트의 `tests/README.md` 에 있다.

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

## GPU 워커

`gpu/` 는 Modal 앱 `imagen-local-gpu` 다. 웹 함수(FastAPI, CPU)가 잡을 받아 `modal.Dict` 에 상태를 쓰고 GPU 클래스(H100 1대, ComfyUI)를 부른다. 완료 통지는 따로 없고, 앱이 대화·잡 조회 때 워커를 폴링해 결과를 가져온다. 아래 명령은 작업공간 루트에서 돌린다.

| 명령 | 하는 일 |
|---|---|
| `npm run qa:worker:setup` | 루트 `.venv` 에 워커 의존성과 pytest 설치 |
| `npm run qa:worker` | 워커 테스트(pytest, 스모크 제외) |
| `npm run qa:worker:mock` | GPU 없이 도는 mock 워커. 8787 포트, 토큰 `dev-token` |
| `npm run qa:worker:smoke` | 배포된 워커를 실제로 부르는 스모크 테스트. H100 과금 |
| `npm run imagen-local:gpu:configure -- secret` | `.env.local` 의 `GPU_API_TOKEN`(없거나 `dev-token` 이면 새로 만든다)과 `HF_TOKEN` 으로 Modal Secret `imagen-local-worker` 를 만든다 |
| `npm run imagen-local:gpu:configure -- url <URL>` | 배포된 워커 주소를 `.env.local` 의 `GPU_API_URL` 에 쓴다 |
| `npm run imagen-local:modal -- run project/imagen-local/gpu/modal_app.py::download_models` | 빠진 모델 파일만 Volume 에 받는다 |
| `npm run imagen-local:modal -- deploy project/imagen-local/gpu/modal_app.py` | 배포. 주소는 `https://<workspace>--imagen-local-gpu-web.<region>.modal.run` |
| `npm run imagen-local:modal -- app logs imagen-local-gpu` | 로그 보기 |
| `npm run imagen-local:modal -- serve project/imagen-local/gpu/modal_ui.py` | 템플릿 내보내기용 ComfyUI UI(CPU, 인증 없음). 내보낸 뒤 바로 내린다 |
| `node tests/imagen-local/tools/export-workflows.mjs <UI 주소>` | 공식 템플릿을 API 포맷으로 내보내 `gpu/workflows/` 에 쓴다 |

- GPU 접속값 `GPU_API_URL`, `GPU_API_TOKEN` 은 `.env.local` 에 있고 `gpu/configure.py` 가 쓴다. Next 는 `.env.local` 을 `.env` 보다 먼저 읽는다.
- ComfyUI 는 컨테이너의 `/root/comfy/ComfyUI` 에 있다. 모델은 Volume `imagen-local-models`(`/models`), 입력·결과 이미지는 Volume `imagen-local-data`(`/data`)에 있다.
- `gpu/workflows/*.json` 은 ComfyUI 공식 템플릿을 내보낸 API 포맷이다. 잡 값(프롬프트·시드·크기·step·입력 이미지·파일 이름)을 넣을 노드 입력은 `bindings.json` 이 정한다. 템플릿이 바뀌면 내보내기 도구로 다시 만든다.
- 마지막 잡 뒤 5분(`scaledown_window`)은 H100 이 켜져 있어 과금된다. 첫 요청은 모델을 올리느라 몇 분 걸린다.
- 이 앱은 localhost 단일 사용자 앱이라 사용자 인증이 없다. 외부에 공개하기 전에 인증을 먼저 붙인다.

## 구조

```
imagen-local/
├── prisma/
│   ├── schema.prisma          # User, Conversation(모델 고정), Job, Image
│   └── migrations/
├── prisma7.config.ts          # Prisma CLI 설정 (Prisma 7.10 의 파일 이름)
├── src/
│   ├── app/
│   │   ├── layout.tsx         # 폰트, Providers, 앱 틀(사이드바·이미지 뷰어)
│   │   ├── page.tsx           # 새 대화: 모델 고르기 + 입력창
│   │   ├── c/[id]/            # 대화 화면, 없는 대화 화면
│   │   ├── gallery/           # 갤러리: 검색·모델 필터
│   │   └── api/
│   │       ├── conversations/ # 목록·생성, [id] 조회(워커 동기화)·삭제, [id]/jobs 잡 추가
│   │       ├── jobs/[id]/     # GET 상태(워커 폴링 동기화)·DELETE 취소
│   │       ├── images/        # 갤러리 목록, [id] 조회·삭제
│   │       ├── uploads/       # 고칠 사진 올리기
│   │       └── files/         # 저장한 이미지·썸네일 서빙
│   ├── components/
│   │   ├── providers.tsx      # React Query, 테마, 툴팁, 토스트
│   │   ├── ui/                # shadcn 생성물
│   │   ├── shell/             # 앱 틀, 사이드바(대화 목록), 상단바
│   │   ├── chat/              # 새 대화, 대화 화면, 입력창, 결과·진행 카드, 비교 슬라이더
│   │   ├── gallery/           # 갤러리 격자·필터
│   │   └── viewer/            # 이미지 뷰어(?image= 딥링크)
│   ├── hooks/
│   ├── lib/
│   │   ├── db.ts              # Prisma 클라이언트 (better-sqlite3 어댑터)
│   │   ├── utils.ts           # cn()
│   │   ├── api/               # API 오류 응답, 라우트 공통 검사(Host·출처)
│   │   ├── api-client.ts      # 브라우저 → 앱 API 호출
│   │   ├── query-keys.ts      # React Query 키
│   │   ├── streams.ts         # 크기 상한을 세며 스트림 읽기
│   │   ├── storage/           # 이미지 저장. 로컬 파일 → S3 로 바꾸는 자리
│   │   ├── images/            # sharp: 회전 보정·축소·썸네일
│   │   ├── gpu/               # config.ts(GPU 종류·개수), 모델 표, 크기 표, 워커 HTTP 클라이언트
│   │   └── jobs/              # 잡 만들기·조회·워커 동기화·상태 전이
│   └── generated/prisma/      # prisma generate 결과물. git 에 올리지 않는다
├── gpu/                       # Modal GPU 워커(Python). 'GPU 워커' 절 참고
│   ├── modal_app.py           # 웹 함수·GPU 클래스·모델 다운로드
│   ├── modal_ui.py            # 템플릿 내보내기용 ComfyUI UI
│   ├── configure.py           # .env.local 접속값과 Modal Secret 설정
│   ├── worker/                # 잡 API(FastAPI), mock·Modal 백엔드, ComfyUI 클라이언트, 러너
│   └── workflows/             # ComfyUI API 포맷 워크플로와 bindings.json
├── storage/                   # 로컬 이미지 저장소(STORAGE_DIR 기본값). git 에 올리지 않는다
├── docs/                      # 모델 리서치
└── public/
```

## 설정 메모

- **Cache Components 가 켜져 있다.** Next 16 템플릿 기본값이다. DB 조회처럼 요청 때마다 달라지는 데이터를 읽는 규칙은 `AGENTS.md` 가 가리키는 `node_modules/next/dist/docs/` 를 따른다.
- **`turbopack.root` 를 이 폴더로 고정했다.** 상위 작업공간에도 `package-lock.json` 이 있어 자동 감지가 그쪽을 루트로 잡는다.
- **shadcn 은 Base UI 기반 `base-nova` 스타일이다.** `cn()` 은 shadcn 이 관리하는 `cn` 패키지에서 온다.
- **색·반경·그림자·글자 스타일은 디자인 시스템 토큰이다.** `src/app/globals.css` 의 shadcn 변수에 연결돼 있고, 디자인 시스템 링크는 `CLAUDE.md` 에 있다.
- **글꼴은 Inter 와 Pretendard 다.** Inter 는 `next/font/google` 로, Pretendard 는 `src/app/fonts/` 의 공식 가변 글꼴 dynamic subset(CSS 하나와 글자 범위별 woff2 조각 92개)을 `layout.tsx` 에서 CSS 로 불러온다. 브라우저는 화면에 쓰인 글자가 든 조각만 받는다. 조각은 공식 배포판 파일 그대로 두고 손대지 않는다(OFL 의 예약 글꼴 이름 때문에 직접 잘라 쓰면 이름을 바꿔야 한다). Pretendard 는 SIL OFL 1.1 이고 원문을 같은 폴더에 둔다.
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
