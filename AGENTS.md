# imagen-local — 에이전트 작업 안내

Hugging Face 오픈 웨이트 이미지 모델을 빌린 GPU에서 실행하는 채팅형 웹앱이다. Next.js가 화면·API를, Python 워커가 Modal·ComfyUI를 통한 추론을 맡는다. 사용자는 대화에서 이미지를 만들고 이어서 고치며, 갤러리·뷰어·휴지통으로 결과를 관리한다.

## 먼저 읽을 것

- 이 문서는 `project/imagen-local/` 작업에 적용한다. **앱 루트**는 이 폴더, **작업공간 루트**는 두 단계 위 `AI/`다. 아래 경로는 별도 표시가 없으면 앱 루트 기준이다.
- 공통 작업 규칙은 [루트 AGENTS.md](../../AGENTS.md), 폴더 배치는 [루트 README.md](../../README.md)가 원본이다. 작업 전 [공통 규칙](../../.agents/rules/common.md)과 수정할 경로에 맞는 분야별 규칙을 읽는다.
- 설치·운영·폴더 구조는 [README.md](README.md)를 읽는다. 명령의 실제 정의는 앱과 작업공간 각각의 `package.json`에서 확인한다.
- 모델 선택·입력 방식·워크플로를 바꿀 때는 [CLAUDE.md](CLAUDE.md)의 **모델**, **입력 방식**, **구현할 때 볼 것**을 읽는다. UI를 바꿀 때는 같은 문서의 **디자인 시스템**을 읽는다. 이 프로젝트의 기존 세부 지침을 담은 문서이므로 Codex도 해당 절을 참고한다.
- `docs/plan/`은 설계·구현 계획의 기록이다. 현재 구현 여부는 코드와 테스트로 확인한다. 모델 리서치에 소개된 기능을 이미 앱에 구현된 기능으로 간주하지 않는다.

## 기술 구성과 작업 진입점

Next.js App Router·React·TypeScript, Tailwind CSS·shadcn(Base UI), TanStack Query를 쓴다. 데이터는 Prisma 7 + SQLite, 이미지 변환은 sharp, 파일은 로컬 저장소에 둔다. 정확한 버전과 업그레이드 제약은 `package.json` 및 README의 **최신이 아닌 버전**을 확인한다.

| 작업 | 먼저 볼 파일·폴더 |
|---|---|
| 새 대화·입력·생성 결과·진행 표시 | `src/app/page.tsx`, `src/app/c/[id]/page.tsx`, `src/components/chat/` |
| 앱 틀·테마·전역 스타일 | `src/app/layout.tsx`, `src/app/globals.css`, `src/components/providers.tsx`, `src/components/shell/` |
| 갤러리·이미지 뷰어 | `src/components/gallery/`, `src/components/viewer/`, `src/lib/location-search.ts` |
| 브라우저 API 호출·캐시 무효화 | `src/lib/api-client.ts`, `src/lib/query-keys.ts` |
| API 입력 검증·오류·Host/출처 검사 | `src/app/api/`, `src/lib/api/errors.ts`, `src/lib/jobs/schemas.ts` |
| 잡 생성·제출·상태 동기화 | `src/lib/jobs/create.ts`, `sync.ts`, `transitions.ts`, `queries.ts` |
| 삭제·복구·영구 삭제 | `src/lib/jobs/trash.ts`, `trash-ttl.ts`, `src/components/trash/`, `src/lib/trash-client.ts` |
| 이미지 정규화·원본·썸네일·미리보기 | `src/lib/images/normalize.ts`, `src/lib/storage/index.ts`, `src/app/api/files/[kind]/[file]/route.ts` |
| DB 모델·접속·마이그레이션 | `prisma/schema.prisma`, `src/lib/db.ts`, `prisma7.config.ts`, `prisma/migrations/` |
| 앱 ↔ GPU 워커 계약 | `src/lib/gpu/client.ts`, `worker-types.ts`, `models.ts`, `sizes.ts`; `gpu/worker/api.py`, `schemas.py`, `models.py` |
| GPU 실행·ComfyUI 연동 | `gpu/modal_app.py`, `gpu/modal_common.py`, `gpu/worker/runner.py`, `comfy.py`, `workflows.py` |

표에서 파일명만 이어 쓴 항목은 바로 앞 파일과 같은 폴더다.

## 이미지 생성 흐름과 데이터 관계

1. 대화 생성 시 모델이 고정된다. 한 번의 생성 요청은 `batchId`로 묶인 여러 `Job`을 만들며, **잡 하나가 이미지 한 장**에 대응한다. 입력 검증·장수 제한·시드·크기 결정은 `src/lib/jobs/create.ts`와 관련 스키마가 담당한다.
2. 잡을 DB 트랜잭션에서 `QUEUED`로 만든 뒤, API 응답 이후 Next의 `after()`에서 워커에 제출한다. 워커 HTTP 호출은 DB 트랜잭션 밖에서 수행한다. `submittedAt`과 진행 중 제출 관리가 중복 제출을 막는다.
3. 대화·잡 조회 API가 `syncJobs()`로 워커 상태를 반영한다. 브라우저는 활성 잡을 폴링한다. 폴링 간격과 대화 전체 재조회 조건은 `src/components/chat/conversation-view.tsx`에 있다.
4. 완료 결과는 PNG 원본과 WebP 썸네일·미리보기로 저장하고 `Image` 행과 잡 상태를 반영한다. 편집 결과는 `parentId`와 `version`으로 입력 이미지와 연결된다.

변경할 때 다음 관계를 유지한다.

- 상태 전이 기준은 `transitions.ts`다. 취소·실패·완료된 잡을 늦게 온 워커 응답으로 덮지 않고, 동시 폴링으로 결과 이미지가 중복 저장되지 않게 한다.
- 일시적인 워커 연결 실패는 잡 실패와 다르다. 활성 잡을 보존하고 `worker.reachable=false`를 반환해 다음 동기화에서 이어간다. 워커의 404 등 개별 오류 처리는 `sync.ts`를 확인한다.
- 일반 삭제는 `deletedAt`을 기록하는 휴지통 이동이다. 대화 복구 시 함께 삭제한 이미지와 먼저 따로 삭제한 이미지를 구별한다. 보관 기간·미사용 업로드 정리 기준과 파일 제거 순서는 `trash-ttl.ts`·`trash.ts`를 따른다.
- 모델 사양은 앱 `src/lib/gpu/models.ts`와 워커 `gpu/worker/models.py`가 일치해야 한다. 공통 검증 자료는 [model-table.json](../../tests/imagen-local/support/model-table.json)이다. 지원 기능을 바꾸면 UI·요청 검증·워커·워크플로의 계약을 함께 확인한다.

## 구현 시 주의할 경계

- `next.config.ts`에서 **Cache Components와 Partial Prefetching이 켜져 있다.** 라우트·요청 시점 데이터·캐시를 바꾸기 전에 아래 Next.js 안내가 가리키는 설치 버전 문서를 읽는다.
- UI 구성은 `components.json`의 Base UI 기반 `base-nova`를 따른다. 디자인 토큰은 `globals.css`가 기준이다. `src/hooks/use-mobile.ts`는 프로젝트에서 수정한 파일이므로 생성 도구로 덮어쓰기 전에 내용을 확인한다.
- `prisma7.config.ts`가 Prisma CLI 설정이다. 스키마 변경 후 마이그레이션과 클라이언트 생성을 구분한다. `src/generated/prisma/`는 생성물이고, DB 파일과 `storage/`는 사용자 데이터다.
- `DATABASE_URL`은 앱과 Prisma CLI가 같은 파일을 가리키는지 확인한다. 상대 `STORAGE_DIR`는 서버 실행 폴더 기준이다. Next에서는 `.env.local`이 `.env`보다 우선하므로 GPU mock을 설정할 때 적용 위치를 확인한다.
- 워커 연결 설정은 `gpu/configure.py`, 운영 절차는 README의 **GPU 워커**를 따른다. 실제 Modal 배포·모델 다운로드·GPU 스모크는 외부 작업이며 과금이 발생할 수 있으므로 루트의 확인 규칙을 적용한다.
- `gpu/workflows/`의 JSON과 `bindings.json`을 바꿀 때는 CLAUDE.md의 내보내기 절차와 [export-workflows.mjs](../../tests/imagen-local/tools/export-workflows.mjs)를 먼저 확인한다.
- 현재 앱은 로컬 단일 사용자용이며 사용자 인증이 없다. `src/lib/api/errors.ts`의 Host·출처 검사와 워커 Bearer 인증은 서로 다른 경계다. 외부 공개나 다중 사용자 지원 작업에서는 인증·소유권 설계를 먼저 다룬다.

## 실행과 검증

앱 명령은 **앱 루트**, `qa:*` 및 아래 `imagen-local:*` 명령은 **작업공간 루트**에서 실행한다. 테스트를 쓰거나 돌리기 전에 [tests/README.md](../../tests/README.md)를 읽는다. 테스트 코드·계획·결과의 위치와 설정 규칙도 그 문서를 따른다.

| 목적 | 실행 위치 | 명령 |
|---|---|---|
| 일반 개발 서버 | 앱 루트 | `npm run dev` — `127.0.0.1:3711` |
| 앱 정적 검사 | 앱 루트 | `npm run lint`, `npm run typecheck` |
| 프로덕션 빌드·실행 | 앱 루트 | `npm run build`, `npm start` — `127.0.0.1:3710` |
| 앱 단위 테스트 | 작업공간 루트 | `npm run qa:unit:imagen-local` |
| 워커 테스트(GPU 스모크 제외) | 작업공간 루트 | `npm run qa:worker` |
| 브라우저·API 테스트 | 작업공간 루트 | `npm run qa:imagen-local` |
| 테스트 코드 정적 검사 | 작업공간 루트 | `npm run qa:typecheck`, `npm run qa:lint` |

GPU 없는 브라우저·API 검증은 작업공간 루트에서 다음 순서로 준비한다.

1. `npm run imagen-local:prisma:test -- migrate deploy`로 테스트 DB 스키마를 적용한다.
2. `npm run qa:worker:mock`(8787)과 `npm run imagen-local:dev:test`(3000)를 각각 실행한다.
3. `npm run qa:imagen-local`을 실행한다. 이 구성은 `test.db`·`storage-test/`를 사용한다. 일반 개발 서버(3711)나 사용자 DB를 테스트 대상으로 혼동하지 않는다.

워커 불통 복구 검증은 `tests/README.md`의 offline 절차를 따른다. 같은 앱 폴더에 개발 서버를 중복 실행하지 않는다. 변경 범위에 맞는 검사를 선택하고, UI 동작 변경은 실행 중인 앱에서도 확인한다.

## 필요할 때 찾아볼 문서

| 상황 | 문서 |
|---|---|
| 모델 지원 범위·보류 항목·프롬프트 처리 | [CLAUDE.md](CLAUDE.md)의 모델·입력 방식·구현할 때 볼 것 |
| 모델 리포·라이선스 근거·다운로드 구성 조사 | [모델 리서치](docs/local-image-models-research.md), [선정 모델과 LoRA](docs/selected-models-and-loras.md) |
| VAE·LoRA·파생판 교체 검토 | [파생판 문서](docs/local-image-model-derivatives.md) |
| 기존 설계 의도와 구현 계획 추적 | [설계](docs/plan/design.md), [구현 계획](docs/plan/plan.md) |

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
