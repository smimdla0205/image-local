# imagen-local v3 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** [audit.md](audit.md) 백로그 B1~B19 를 [design.md](design.md) 대로 구현한다: 휴지통 기반 삭제, 자리표시자, 상태·오류·빈 화면, 사이드바 조절, 접근성, 성능, 문구 통일.

**Architecture:** Prisma 7 + SQLite 에 `deletedAt` 소프트 삭제를 더하고 읽기 경로마다 필터를 건다. 클라이언트는 공용 다이얼로그·Empty·LoadError 컴포넌트로 상태를 통일한다. 성능은 SSR 이미지 가시성, 이미지 우선순위, React Query stale 정책, zod 분리, 정적 셸로 다룬다.

**Tech Stack:** Next.js 16.4.3 (App Router, Cache Components, PPR), React 19.3, TanStack Query 5, Prisma 7 + better-sqlite3, shadcn base-nova, Tailwind 4, Playwright(e2e·api), vitest(unit).

**Spec:** [audit.md](audit.md) §3 백로그(수용 기준), [design.md](design.md)(화면·문구).

## Global Constraints

- 경로: 앱은 `project/imagen-local/`, 테스트는 작업공간 루트 `tests/imagen-local/`(README 의 구조·규칙). 앱 폴더에 테스트를 두지 않는다.
- 테스트 실행(루트): e2e·api `npx playwright test <spec> --project imagen-local --workers=1`(앱 3000 = `npm run imagen-local:dev:test`, mock 워커 8787 = `npm run qa:worker:mock`), unit `npx vitest run --config vitest.config.ts <file>`, 테스트 코드 검사 `npm run qa:typecheck`·`npm run qa:lint`. 앱: `npm run typecheck`·`npm run lint`·`npm run build`(앱 폴더).
- 테스트 DB 마이그레이션(루트): `npm run imagen-local:prisma:test -- migrate dev --name <이름>` 뒤 앱 폴더에서 `npm run db:generate`. 개발 DB 는 `npm run db:migrate`(앱 폴더).
- 브라우저 테스트는 `tests/support/fixtures.ts` 의 `test`·`expect`(콘솔 에러·5xx 가 나면 실패). 로케이터는 role·label. API 테스트는 `tests/imagen-local/support/api.ts` 의 `createConversation`·`waitForJob`·`uniquePrompt`.
- 문구: 해요체, 이모지·느낌표 없음, 진행형은 "…", 삭제 동사는 "삭제". 모델명 공식 표기. 12px 미만 글자 없음. `signal` 은 진행·선택·포커스·드래그 중 핸들에만.
- Next 16.4 API 는 `node_modules/next/dist/docs/` 로 확인한다(`after`, `error.tsx` 의 `retry`, `connection`).
- 새 의존성 없음. 커밋은 한국어, 항목 하나 = 커밋 하나, 브랜치 `feat/imagen-v3`(앱 git 루트 `project/imagen-local`). `tests/` 는 git 밖이라 커밋에 들어가지 않는다.
- phase 가 끝날 때 `/code-review`, `/security-review`, `/codex:review --wait` → `superpowers:receiving-code-review` 로 검증해 고치고 "리뷰 반영" 커밋.

## Review Focus

1. 휴지통에 있는 대화의 잡이 워커에서 끝나 `saveOutput` 이 돌면 이미지가 되살아나면 안 된다 → Task 1 테스트 "휴지통 대화의 잡은 취소되고 결과가 붙지 않는다".
2. 이미지 하나를 먼저 지운 뒤 대화를 지우고 대화를 복구하면 그 이미지는 휴지통에 남아야 한다(같은 `deletedAt` 만 복구) → Task 1 테스트.
3. `?image=` 딥링크가 휴지통 이미지를 가리키면 뷰어는 "이미지를 찾을 수 없어요"(404) → Task 1 API 테스트 + 기존 e2e.
4. 쿠키 `sidebar_width` 가 깨진 값("abc", "999")이면 12~24rem 으로 보정한다 → Task 9 unit 테스트.
5. 삭제 모달의 숫자는 폴링으로 갱신된 상세의 counts 를 쓴다. 대화에 진행 중 잡이 없으면 K 줄이 없다 → Task 2 e2e.

---

## Phase 1 — 삭제·휴지통

### Task 1: 소프트 삭제 스키마와 API (B12 서버)

**Files:**
- Modify: `prisma/schema.prisma` (Conversation·Image 에 `deletedAt DateTime?` + `@@index([deletedAt])`), 새 마이그레이션 `prisma/migrations/<ts>_trash/migration.sql`
- Create: `src/lib/jobs/trash.ts`
- Modify: `src/lib/jobs/queries.ts`, `src/lib/jobs/schemas.ts`, `src/lib/jobs/create.ts:37-50`, `src/lib/jobs/sync.ts:49-77`, `src/app/api/conversations/[id]/route.ts`, `src/app/api/conversations/[id]/jobs/route.ts`, `src/app/api/conversations/route.ts`, `src/app/api/images/[id]/route.ts`, `src/app/api/images/route.ts`, `src/app/c/[id]/page.tsx`
- Create: `src/app/api/conversations/[id]/restore/route.ts`, `src/app/api/images/[id]/restore/route.ts`, `src/app/api/images/[id]/refs/route.ts`, `src/app/api/trash/route.ts`
- Modify: `tests/imagen-local/support/api.ts:33`(정리를 휴지통 이동 + 영구 삭제로), `tests/imagen-local/api/conversations.spec.ts:114-123`, `tests/imagen-local/api/images.spec.ts:43-77`
- Test: `tests/imagen-local/api/trash.spec.ts`, `tests/imagen-local/unit/trash.test.ts`

**Interfaces:**
- Produces (`src/lib/jobs/trash.ts`): `TRASH_TTL_DAYS = 30`, `UPLOAD_TTL_HOURS = 24`, `trashExpiresAt(deletedAt: Date): Date`, `trashCutoff(now: Date): Date`, `staleUploadCutoff(now: Date): Date`, `trashConversation(id: string): Promise<{ id: string; deletedAt: string } | null>`(대화·이미지에 같은 `now`, 활성 잡 전부 워커 취소(submittedAt 무관, 실패 무시) + DB `CANCELLED`), `restoreConversation(id)`, `trashImage(id)`, `restoreImage(id)`(대화가 휴지통이면 `ApiError(409, "conversation_in_trash")`), `listTrash(): Promise<TrashDto>`, `purgeTrash(opts: { conversationIds?: string[]; imageIds?: string[]; before?: Date }): Promise<{ conversations: number; images: number }>`(행 삭제 + `deleteImageFiles`), `purgeExpired(now)`, `purgeStaleUploads(now)`.
- Produces (`schemas.ts`): `ConversationDto` 에 `deletedAt: string | null`; `ImageDto` 에 `deletedAt: string | null`; `TrashConversationDto = ConversationDto & { deletedAt: string; expiresAt: string; imageCount: number }`; `TrashImageDto = ImageDto & { deletedAt: string; expiresAt: string }`; `TrashDto = { conversations: TrashConversationDto[]; images: TrashImageDto[] }`; `ImageRefsDto = { children: number; inputFor: number }`; `purgeBodySchema`(위 opts, `before` 는 ISO).
- API: `DELETE /api/conversations/[id]` → 휴지통 이동 `{ id, deletedAt }`; `POST /api/conversations/[id]/restore` → `ConversationDto`; `DELETE /api/images/[id]` → `{ id, deletedAt }`; `POST /api/images/[id]/restore` → `ImageDto`; `GET /api/images/[id]/refs` → `ImageRefsDto`; `GET /api/trash` → `TrashDto`(먼저 `purgeExpired`·`purgeStaleUploads`); `DELETE /api/trash`(body 선택) → purge 결과.
- 읽기 필터: `getConversationDetail`·`listConversations`·갤러리 `where` 에 `deletedAt: null`; `toJobDto` 는 휴지통 이미지를 `image`/`inputImage` null 로; 상세 썸네일도 제외. `GET /api/images/[id]` 휴지통이면 404. `createJobs` 입력 이미지가 휴지통이면 400 `input_image_not_found`; 휴지통 대화에 잡 추가는 404. `saveOutput` 은 대화가 휴지통이면 결과 이미지를 `deletedAt = 대화.deletedAt` 로 저장한다.

- [x] **Step 1: unit 테스트 작성** `tests/imagen-local/unit/trash.test.ts`: `trashExpiresAt(new Date('2026-01-01T00:00:00Z'))` → `2026-01-31T00:00:00Z`; `trashCutoff(now)` = now−30일; `staleUploadCutoff(now)` = now−24시간 (toISOString 비교).
- [x] **Step 2: 실행해 실패 확인** `npx vitest run --config vitest.config.ts tests/imagen-local/unit/trash.test.ts` → 모듈 없음으로 FAIL.
- [x] **Step 3: API 테스트 작성** `tests/imagen-local/api/trash.spec.ts`(`createConversation`/`waitForJob` 사용):
  - "대화 삭제는 휴지통 이동: 목록·상세에서 사라지고 파일은 남는다" — DELETE 200 `{id, deletedAt}`; GET 상세 404; `/api/conversations` 목록에 없음; `GET image.previewUrl` 200; `GET /api/trash` conversations 에 id·`imageCount: 1`·`expiresAt` = deletedAt+30일.
  - "복구하면 돌아온다" — POST restore 200 → GET 상세 200, 갤러리에 이미지 있음.
  - "먼저 지운 이미지는 대화 복구 뒤에도 휴지통에 남는다" — 이미지 2장(count 2) 중 1장 DELETE → 대화 DELETE → 대화 restore → 상세 jobs 중 그 잡의 `image` 는 null, `/api/trash` images 에 그 id.
  - "휴지통 이미지는 404, 갤러리·refs" — DELETE image → GET `/api/images/[id]` 404; 갤러리 목록에 없음; `GET /api/images/[v1]/refs` 가 고치기 뒤 `{ children: 1, inputFor: 1 }`.
  - "휴지통 이미지를 입력으로 쓰면 400" — `input_image_not_found`.
  - "휴지통 대화의 잡은 취소되고 결과가 붙지 않는다" — count 4 생성 직후 DELETE → `/api/jobs/[id]` 상태가 CANCELLED, 3초 뒤에도 `image` null, 갤러리에 없음.
  - "비우기는 행과 파일을 지운다" — DELETE `/api/trash` body `{ conversationIds: [id] }` → 200 `{ conversations: 1, images: n }`; previewUrl 404; `/api/trash` 비어 있음.
  - "복구 충돌" — 대화 휴지통 상태에서 그 이미지 restore → 409 `conversation_in_trash`.
- [x] **Step 4: 기존 테스트 기대값을 새 동작으로** `api/conversations.spec.ts:114-123`(삭제 뒤 404 는 유지, 파일 삭제 단언은 purge 뒤로), `api/images.spec.ts:43-77`(파일 404 → 200, purge 뒤 404), `support/api.ts` `cleanupConversations` → DELETE 뒤 `DELETE /api/trash` body ids.
- [x] **Step 5: 실행해 실패 확인** `npx playwright test tests/imagen-local/api/trash.spec.ts --project imagen-local --workers=1` → 404/필드 없음으로 FAIL.
- [x] **Step 6: 스키마·마이그레이션** 두 모델에 `deletedAt DateTime?`, `@@index([deletedAt])`. `npm run imagen-local:prisma:test -- migrate dev --name trash` → 생성된 SQL 이 `ALTER TABLE ... ADD COLUMN "deletedAt" DATETIME` + `CREATE INDEX` 뿐인지 읽는다. `npm run db:generate`. 개발 DB: `cp dev.db dev.db.bak` 뒤 `npm run db:migrate`.
- [x] **Step 7: 구현** Interfaces 대로 `trash.ts` 와 라우트, 읽기 필터, DTO 필드(`deletedAt`). `trashConversation` 은 트랜잭션 하나로 대화·이미지 `deletedAt=now`, 활성 잡 `CANCELLED`; 워커 취소는 트랜잭션 밖에서 `allSettled`. `saveOutput`(sync.ts) 은 대화의 `deletedAt` 을 읽어 이미지에 복사한다.
- [x] **Step 8: 실행해 통과 확인** unit → PASS, `api/trash.spec.ts` PASS, `api/conversations.spec.ts`·`api/images.spec.ts`·`api/jobs.spec.ts` PASS, 앱 `npm run typecheck && npm run lint`.
- [x] **Step 9: 커밋** `git add -A && git commit -m "추가: 대화·이미지 소프트 삭제(휴지통)와 복구·비우기 API"`

### Task 2: 삭제 모달·토스트·타일 삭제 (B1, B8 클라이언트)

**Files:**
- Modify: `src/lib/jobs/schemas.ts`(`ConversationDetailDto` 에 `counts`), `src/lib/jobs/queries.ts:66-77,97-100`
- Create: `src/components/image-delete-dialog.tsx`, `src/components/chat/styles.ts`(`FLOAT_CLASS`, `ICON_BUTTON_CLASS`, `DANGER_TEXT` 이동)
- Modify: `src/components/chat/conversation-menu.tsx`, `src/components/chat/result-card.tsx:25-45`, `src/components/gallery/gallery-grid.tsx:37-49`, `src/components/gallery/gallery-view.tsx`, `src/components/viewer/viewer-panel.tsx:39-47,121-141`, `src/components/viewer/image-viewer-dialog.tsx:56-70`, `src/components/chat/conversation-view.tsx:77,116-119`, `src/components/ui/alert-dialog.tsx`(Action 에 `variant="destructive"` 허용 확인), `src/lib/query-keys.ts`(`trash: { all: ["trash"] }`)
- Test: `tests/imagen-local/e2e/trash.spec.ts`, 수정 `tests/imagen-local/e2e/gallery.spec.ts:142-162`, `tests/imagen-local/e2e/conversation.spec.ts`(삭제 문구)

**Interfaces:**
- `ConversationDetailDto.counts: { images: number; activeJobs: number; linkedConversations: number }` — `getConversationDetail` 이 세 개를 센다(images: `kind != UPLOADED && deletedAt null`; linked: 이 대화 이미지를 `inputImageId` 로 쓰는 다른 대화 수).
- `ImageDeleteDialog({ image: ImageDto | null; onOpenChange(open: boolean): void; onDeleted?(id: string): void })`: 열리면 `GET /api/images/[id]/refs`, 확인하면 `DELETE /api/images/[id]`, 성공 시 `queryClient.invalidateQueries(images.all)`·`(conversations.all)`·`(trash.all)`, 토스트 `toast.success("휴지통으로 옮겼어요", { action: { label: "되돌리기", onClick } })`(되돌리기 = `POST restore` + 같은 무효화 + "복구했어요"). 실패 시 모달 유지 + `toast.error`. 진행 중 버튼 "삭제하는 중…" disabled, `AlertDialog` 닫힘 방지.
- `TileActions` 에 `onDelete(image: ImageDto)`; `GalleryGrid` 에 `onDelete`; `ResultCard` props 에 `onDelete` 추가(`Handlers`).

- [x] **Step 1: e2e 테스트 작성** `e2e/trash.spec.ts`:
  - "대화 삭제 모달이 이미지 수를 말하고 되돌리기가 된다" — count 2 생성·완료 후 `/c/[id]` → 대화 메뉴 → 대화 삭제 → alertdialog "휴지통으로 옮길까요?" 에 "이미지 2장도 함께 옮겨요" 보임, "진행 중" 문구 없음 → 삭제 → URL `/` → 토스트 "휴지통으로 옮겼어요" → "되돌리기" 클릭 → 사이드바에 대화 다시 보임.
  - "진행 중 잡이 있으면 중단 줄이 보인다" — 생성 직후 모달에 "진행 중 1건을 중단해요".
  - "결과 카드와 갤러리 타일에서 삭제" — 결과 카드 hover 동작 "삭제" → 모달 "이미지를 삭제할까요?" → 삭제 → 자리에 "삭제한 이미지예요"; 갤러리 타일 "삭제" → 목록에서 사라짐; 삭제한 이미지가 고칠 이미지 칩이면 칩 없음.
  - "삭제 실패 시 모달이 남는다" — `page.route('**/api/images/*', 500)` 뒤 삭제 → alertdialog 여전히 보임 + 오류 토스트 (`allowedErrors: [/status of 500/]`).
- [x] **Step 2: 기존 e2e 문구 갱신** `gallery.spec.ts:149,159`("삭제하면 되돌릴 수 없어요" → 새 모달: "30일 안에 휴지통에서 복구할 수 있어요"), `conversation.spec.ts` 의 삭제 시나리오.
- [x] **Step 3: 실행해 실패 확인** `npx playwright test tests/imagen-local/e2e/trash.spec.ts --project imagen-local --workers=1` → FAIL.
- [x] **Step 4: 구현** counts 계산, 공용 다이얼로그, 메뉴 문구(design.md B1), 타일 삭제 버튼(순서 끝), 뷰어의 자체 AlertDialog 를 공용으로 교체(삭제 뒤 뷰어 닫기 = `?image` 제거), `manualTarget` 해제. 클래스 상수는 `styles.ts` 로.
- [x] **Step 5: 실행해 통과 확인** `e2e/trash.spec.ts`, `e2e/gallery.spec.ts`, `e2e/conversation.spec.ts` PASS. `npm run typecheck && npm run lint`.
- [x] **Step 6: 커밋** `git commit -am "추가: 삭제 모달에 함께 사라지는 것 안내, 되돌리기 토스트, 타일에서 이미지 삭제"`

### Task 3: 휴지통 페이지 (B12 클라이언트)

**Files:**
- Create: `src/app/trash/page.tsx`, `src/components/trash/trash-view.tsx`, `src/components/trash/trash-row.tsx`
- Modify: `src/components/shell/app-sidebar.tsx:99-119`(바로가기 "휴지통"), `src/components/chat/conversation-menu.tsx`(모달 마지막 줄 "30일 안에…")
- Test: `tests/imagen-local/e2e/trash.spec.ts`(추가), `tests/imagen-local/a11y/pages.spec.ts`(`/trash` 추가)

**Interfaces:**
- `TrashView()`: `useQuery(queryKeys.trash.all, GET /api/trash)`; 행마다 "복구"(`POST restore`)·"영구 삭제"(`DELETE /api/trash` body 하나); Topbar `actions` 에 "비우기" → AlertDialog "휴지통을 비울까요?" + "대화 N개와 이미지 M장이 영구히 지워져요" → `DELETE /api/trash` 전체. 날짜 묶음은 `src/components/shell/day-groups.ts` 재사용. 남은 일수 `D-${days}`.

- [x] **Step 1: e2e 테스트 작성** "휴지통에서 복구·영구 삭제·비우기": 대화 삭제 → `/trash` 에 행(제목, "대화 · 이미지 1장", "D-30") → "복구" → 행 사라지고 `/c/[id]` 200; 다시 삭제 → "영구 삭제" → 확인 없이 행 사라짐 + `GET previewUrl` 404; 이미지 하나 삭제 → "비우기" → alertdialog "휴지통을 비울까요?" → 비우기 → "휴지통이 비어 있어요". a11y: `/trash` axe 위반 0.
- [x] **Step 2: 실행해 실패 확인** → 404 로 FAIL.
- [x] **Step 3: 구현** design.md B12 대로. 페이지는 `Suspense` + `TrashSkeleton`(행 5줄).
- [x] **Step 4: 통과 확인** e2e·a11y PASS, typecheck·lint.
- [x] **Step 5: 커밋** `git commit -am "추가: 휴지통 페이지(복구·영구 삭제·비우기·30일 자동 정리)"`

### Task 4: 삭제한 이미지 자리표시자 (B2)

**Files:**
- Create: `src/components/chat/deleted-image.tsx`
- Modify: `src/components/chat/result-card.tsx:66-68,94-97,106,145,151`, `src/components/chat/thread.tsx:24-32`
- Test: `tests/imagen-local/e2e/trash.spec.ts`(추가)

**Interfaces:**
- `DeletedImage({ width, height, size }: { width: number; height: number; size: "tile" | "ref" })` → `role="img" aria-label="삭제한 이미지예요"`, tile 은 `style={{ aspectRatio: \`${width} / ${height}\` }}`, `ImageOffIcon` 20px(ref 는 16px), 글자 "삭제한 이미지예요", tile 에 `Link href="/trash"` "복구".
- 결과 section `aria-label`: 남은 이미지 수가 0 이면 "삭제한 이미지", 아니면 `만든 이미지 ${n}장`. EDIT 잡의 `inputImage === null && status === SUCCEEDED` 면 "다시 생성" 대신 `<p class="text-caption text-muted-foreground">원본을 삭제해서 다시 고칠 수 없어요</p>`.

- [x] **Step 1: e2e 테스트 작성** "지운 이미지 자리에 비율 틀과 복구 링크": 2:3(ratio) 생성 후 삭제 → 결과 영역 `getByRole('img', { name: '삭제한 이미지예요' })` 보임, computed `aspect-ratio` 가 `"<w> / <h>"`, 안에 "복구" 링크 `/trash`; section 라벨 "삭제한 이미지"; 고치기 원본 삭제 뒤 "원본을 삭제해서 다시 고칠 수 없어요" 보이고 "다시 생성" 없음.
- [x] **Step 2: 실패 확인** → FAIL.
- [x] **Step 3: 구현** 두 자리에 `DeletedImage` 적용, 라벨·사유.
- [x] **Step 4: 통과 확인** + `e2e/conversation.spec.ts` PASS.
- [x] **Step 5: 커밋** `git commit -am "추가: 삭제한 이미지 자리표시자(비율 틀·복구 링크·사유)"`

### Phase 1 리뷰
- [x] `/code-review`, `/security-review`, `/codex:review --wait` → 지적을 `superpowers:receiving-code-review` 로 검증·수정 → 테스트 재실행 → `git commit -am "리뷰 반영: 삭제·휴지통"`

## Phase 2 — 상태·오류·빈

### Task 5: 오류·재시도·끊김·삭제된 대화 (B9)

**Files:**
- Create: `src/components/ui/load-error.tsx`
- Modify: `src/components/shell/app-sidebar.tsx:48-52`, `src/components/gallery/gallery-view.tsx:73-102`, `src/components/viewer/image-viewer-dialog.tsx:81-88`, `src/components/chat/conversation-view.tsx:35-64,182-196`, `src/components/chat/worker-banner.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/c/[id]/not-found.tsx`
- Test: `tests/imagen-local/e2e/errors.spec.ts`

**Interfaces:**
- `LoadError({ message, onRetry, align = "start" }: { message: string; onRetry: () => void; align?: "start" | "center" })` → `CircleAlertIcon` + 문구 + `Button variant="outline" size="sm"` "다시 불러오기".
- ConversationView: `query.isError` → `<PollingStatus />`(`role="status"`, "연결이 끊겼어요. 다시 시도하는 중…", `RefreshCwIcon`), 404(`ApiClientError.status === 404`) → `retry: false`·`refetchInterval: false` + `<DeletedConversation />`(Empty: "삭제된 대화예요" / "휴지통에서 복구하거나 새 대화를 시작하세요" / 버튼 "휴지통"·"새 대화"). `error.tsx`: Next 16.4 `error.md` 가 주는 `retry` 사용(없으면 `reset` + `router.refresh()`), 링크 "새 대화로", `<main>` 대신 `<div>` + `<h1>`.

- [x] **Step 1: e2e 테스트 작성** `errors.spec.ts`(`allowedErrors: [/status of 500/, /status of 404/]`): 사이드바·갤러리 500 → "다시 불러오기" 보이고 route 해제 후 클릭하면 목록 보임; 뷰어 500 → 같은 버튼; 대화 폴링 500(생성 중) → status "연결이 끊겼어요. 다시 시도하는 중…"; 다른 탭에서 삭제(API DELETE) 뒤 폴링 → "삭제된 대화예요" + "휴지통" 링크, 이후 3초간 `/api/conversations/[id]` 요청 0건.
- [x] **Step 2: 실패 확인**.
- [x] **Step 3: 구현**.
- [x] **Step 4: 통과 확인** + `e2e/loading.spec.ts` PASS.
- [x] **Step 5: 커밋** `git commit -am "추가: 오류마다 다시 불러오기, 폴링 끊김 표시, 삭제된 대화 안내"`

### Task 6: 빈 상태 (B14)

**Files:**
- Modify: `src/components/shell/app-sidebar.tsx:48-52`, `src/components/gallery/gallery-view.tsx:73-102`, `src/components/ui/empty.tsx`(필요 시 `EmptyActions`)
- Test: `tests/imagen-local/e2e/gallery.spec.ts`(빈 상태 테스트 확장), `tests/imagen-local/e2e/new-chat.spec.ts`(사이드바 빈 상태)

- [x] **Step 1: 테스트** 갤러리 `?q=없는태그` → "찾는 이미지가 없어요" + 버튼 "필터 지우기" → 클릭 → URL `/gallery`; 빈 DB 상황은 만들 수 없으므로 사이드바 빈 상태는 `page.route('**/api/conversations', { items: [] })` 로 → "아직 대화가 없어요" + 링크 "새 대화".
- [x] **Step 2: 실패 확인**. **Step 3: 구현**(design.md B14). **Step 4: 통과**. 
- [x] **Step 5: 커밋** `git commit -am "추가: 빈 상태에 다음 행동(새 대화·필터 지우기)"`

### Task 7: 스켈레톤 빈틈과 낭독 (B7)

**Files:**
- Modify: `src/components/viewer/image-viewer-dialog.tsx:73-88`, `src/components/chat/composer.tsx:141-150`, `src/components/chat/target-chip.tsx`, `src/components/chat/new-chat.tsx:33-40`, `src/components/gallery/gallery-view.tsx:96,115-121`, `src/components/shell/app-sidebar.tsx:36`, `src/components/chat/conversation-view.tsx:204`, `src/components/ui/skeleton.tsx`
- Test: `tests/imagen-local/e2e/loading.spec.ts`(확장)

**Interfaces:**
- `ViewerSkeleton()`, `TargetChipSkeleton({ label }: { label: "올리는 중…" | "불러오는 중…" })`, `GalleryTilesSkeleton({ count })`. 스켈레톤 컨테이너: `aria-busy="true"` + `<span className="sr-only">불러오는 중…</span>`; 조각은 `aria-hidden`.

- [x] **Step 1: 테스트** 뷰어 딥링크에 `page.route` 로 `/api/images/[id]` 를 2초 지연 → `dialog[aria-busy=true]` 와 sr-only "불러오는 중…" 보임, 스피너(`role=status` "불러오는 중") 없음; `?edit=nope` → "고칠 이미지를 찾을 수 없어요"(`allowedErrors 404`); 갤러리 더 보기 지연 → 버튼 "불러오는 중…" disabled + 타일 스켈레톤 8개; 사이드바·갤러리·새 대화·대화 스켈레톤 컨테이너 `aria-busy=true`.
- [x] **Step 2: 실패 확인**. **Step 3: 구현**. **Step 4: 통과** + `a11y/pages.spec.ts`.
- [x] **Step 5: 커밋** `git commit -am "추가: 뷰어·업로드·고칠 이미지·더 보기 스켈레톤과 aria-busy"`

### Phase 2 리뷰
- [x] 세 리뷰 → 수정 → `git commit -am "리뷰 반영: 상태·오류·빈"`

## Phase 3 — 레이아웃·접근성

### Task 8: 사이드바 접기 유지 (B5)

**Files:**
- Modify: `src/app/layout.tsx`(인라인 스크립트), `src/app/globals.css`, `src/components/ui/sidebar.tsx:56-150`
- Test: `tests/imagen-local/e2e/sidebar.spec.ts`

**Interfaces:**
- 인라인 스크립트(`<head>`): `sidebar_state=false` 쿠키면 `document.documentElement.dataset.sidebar = "collapsed"`; `sidebar_width=<rem>` 쿠키면 `document.documentElement.style.setProperty("--sidebar-width-user", w + "rem")`(12~24 로 보정). CSS: `html[data-sidebar="collapsed"] [data-slot="sidebar-gap"] { width: 0 }`, `html[data-sidebar="collapsed"] [data-slot="sidebar-container"][data-side="left"] { left: calc(var(--sidebar-width) * -1) }`. Provider: mount 효과에서 `dataset.sidebar === "collapsed"` 면 `_setOpen(false)` 뒤 속성 제거. 래퍼 `--sidebar-width: var(--sidebar-width-user, 16rem)`.

- [x] **Step 1: 테스트** 접고 reload → `button[name=사이드바 열기]` 보임, 접기 버튼 없음; `page.evaluate` 로 첫 페인트 전 `html[data-sidebar]`(`addInitScript` 로 MutationObserver 기록) 또는 `document.documentElement.dataset.sidebar === 'collapsed'` 를 `domcontentloaded` 직후 확인; 새 context 에 쿠키 복사 → 접힌 채.
- [x] **Step 2: 실패**. **Step 3: 구현**. **Step 4: 통과**(hydration 경고가 콘솔 에러로 잡히면 FAIL 이므로 서버 마크업은 펼침 그대로 둔다).
- [x] **Step 5: 커밋** `git commit -am "수정: 사이드바 접기 상태를 새로고침·새 탭에서도 유지"`

### Task 9: 사이드바 너비 조절 (B10)

**Files:**
- Modify: `src/components/ui/sidebar.tsx`(`SidebarRail` → `SidebarResizeHandle`, 컨텍스트에 `width`, `setWidth`, `resizing`), `src/components/shell/app-sidebar.tsx:130-140`, `src/app/globals.css`
- Create: `src/lib/sidebar-width.ts`
- Test: `tests/imagen-local/unit/sidebar-width.test.ts`, `tests/imagen-local/e2e/sidebar.spec.ts`(추가)

**Interfaces:**
- `src/lib/sidebar-width.ts`: `SIDEBAR_WIDTH_DEFAULT = 16`, `SIDEBAR_WIDTH_MIN = 12`, `SIDEBAR_WIDTH_MAX = 24`, `SIDEBAR_WIDTH_STEP = 1`(rem), `clampSidebarWidth(raw: unknown): number`(숫자 아님·범위 밖 → 보정, NaN → 16), `readSidebarWidthCookie(cookie: string): number`.
- `SidebarResizeHandle()`: `role="separator" aria-orientation="vertical" aria-label="사이드바 너비" aria-valuemin={192} aria-valuemax={384} aria-valuenow={width*16} tabIndex={0}`; pointer capture 드래그(`clientX / 16` rem), ←→ ±1rem, Home/End, 더블클릭 기본값; 드래그 중 래퍼 `data-resizing` → CSS `[data-resizing] * { transition: none } [data-resizing] { user-select: none }`. 변경 시 쿠키 `sidebar_width`(7일) + `--sidebar-width-user`.

- [x] **Step 1: unit 테스트** `clampSidebarWidth("abc")` → 16, `("999")` → 24, `(5)` → 12, `("18.5")` → 18.5; `readSidebarWidthCookie("a=1; sidebar_width=20")` → 20.
- [x] **Step 2: e2e 테스트** 핸들(`separator[name=사이드바 너비]`) 을 `mouse.down/move/up` 으로 +100px → `[data-slot=sidebar-container]` 너비 356px; 키보드 ArrowLeft ×2 → 324px; reload → 유지; 더블클릭 → 256px.
- [x] **Step 3: 실패**. **Step 4: 구현**. **Step 5: 통과**(`a11y/pages.spec.ts` 도).
- [x] **Step 6: 커밋** `git commit -am "추가: 사이드바 너비 드래그·키보드 조절과 유지"`

### Task 10: 접근성 묶음 (B17)

**Files:**
- Modify: `src/components/ui/sidebar.tsx`(접힘 `inert`, Sheet 제목 "메뉴"/설명 "대화 목록과 바로가기", sr-only 영어 제거), `src/components/shell/topbar.tsx`(접힘 시 포커스 이동), `src/components/shell/app-shell.tsx`(`SidebarInset id="main"`), `src/app/layout.tsx`(skip link), `src/app/globals.css`(scroll-padding, 포커스 링), `src/components/ui/button.tsx:6`, `src/components/ui/input.tsx:11`, `src/components/ui/textarea.tsx:28`, `src/components/ui/badge.tsx:7`, `src/components/ui/switch.tsx:18`, `src/components/chat/composer.tsx:123,138`, `src/components/ui/sonner.tsx`, `src/components/chat/result-card.tsx:54`, `src/components/gallery/gallery-grid.tsx:31`, `src/components/viewer/image-viewer-dialog.tsx:98`, `src/lib/jobs/constants.ts`(Task 14 와 공유; 먼저 만들면 Task 14 가 옮긴다)
- Test: `tests/imagen-local/e2e/a11y-keyboard.spec.ts`, `tests/imagen-local/unit/prompt-alt.test.ts`

**Interfaces:**
- `promptAlt(prompt: string | null, pos?: { n: number; total: number }): string` → 앞 80자(`…` 없이 자름) + total > 1 이면 ` (n/total)`; null 이면 "올린 사진".

- [x] **Step 1: 테스트** unit: `promptAlt("a".repeat(100), { n: 2, total: 4 })` 길이 86·끝 "(2/4)"; e2e: 첫 Tab 에 링크 "본문으로 건너뛰기" 보이고 Enter 로 `#main` 포커스; 접은 뒤 `document.activeElement` 가 "사이드바 열기" 버튼; 접힌 상태에서 Tab 을 20번 눌러도 사이드바 링크에 포커스 없음(`nav[aria-label=대화 목록] a:focus` 0); `html` computed `scroll-padding-top` ≠ `auto`; 모바일 Sheet 제목 "메뉴"; 토스트 영역 `region[name=알림]`.
- [x] **Step 2: 실패**. **Step 3: 구현**. **Step 4: 통과** + `a11y/pages.spec.ts`.
- [x] **Step 5: 커밋** `git commit -am "수정: 건너뛰기 링크, 접힌 사이드바 inert, 포커스 링 통일, alt 길이, 한국어 라벨"`

### Phase 3 리뷰
- [x] 세 리뷰 → 수정 → `git commit -am "리뷰 반영: 레이아웃·접근성"`

## Phase 4 — 성능

### Task 11: SSR 이미지 즉시 표시 (B3)

**Files:**
- Modify: `src/components/fade-image.tsx`, `src/app/globals.css:197-241`
- Test: `tests/imagen-local/api/ssr.spec.ts`

- [x] **Step 1: 테스트** 완료된 대화 `/c/[id]` HTML(`request.get`)에 `data-loading` 0건, `<img` 는 있음; e2e `loading.spec.ts` 의 페이드 동작(새로 받는 이미지)은 그대로 통과.
- [x] **Step 2: 실패**. **Step 3: 구현** 첫 렌더는 속성 없이, ref 콜백에서 `!el.complete` 일 때만 `loading` 상태로, `onLoad/onError` 로 해제. **Step 4: 통과**. 트레이스로 render delay 보고(8단계).
- [x] **Step 5: 커밋** `git commit -am "수정: 서버가 그린 이미지는 hydration 전에도 보이게"`

### Task 12: 이미지 우선순위 (B4)

**Files:**
- Modify: `src/components/gallery/gallery-grid.tsx`(`startIndex` prop), `src/components/gallery/gallery-view.tsx`, `src/components/chat/result-card.tsx:52-59`, `src/components/chat/compare-slider.tsx:20-24`, `src/components/chat/thread.tsx:27,52`, `src/components/shell/app-sidebar.tsx:75`
- Test: `tests/imagen-local/e2e/perf.spec.ts`(확장)

- [x] **Step 1: 테스트** 갤러리(≥9장): 앞 8 `img[loading=eager]`, 앞 4 `fetchpriority=high`, 9번째 lazy; 사이드바 `img` 전부 `loading=lazy fetchpriority=low`; 대화 마지막 배치 img `eager`+`high`, 첫 배치 `lazy`; 입력 말풍선 img `lazy`.
- [x] **Step 2: 실패**. **Step 3: 구현**(`ResultCard` 에 `priority?: boolean`, Thread 가 마지막 배치에만 true). **Step 4: 통과**.
- [x] **Step 5: 커밋** `git commit -am "수정: 보이는 이미지 먼저, 사이드바 썸네일은 낮은 우선순위"`

### Task 13: stale 정책 (B6)

**Files:**
- Modify: `src/components/chat/conversation-view.tsx:35-64`, `src/components/gallery/gallery-view.tsx:39-53`, `src/components/shell/app-sidebar.tsx:48`
- Test: `tests/imagen-local/e2e/perf.spec.ts`(확장)

- [x] **Step 1: 테스트** 완료된 대화 진입 뒤 3초 동안 `GET /api/conversations/[id]` 0건; 생성 중이면 1초 안에 `?ids=` 폴링 있음; `page.evaluate(() => window.dispatchEvent(new Event('focus')))` 뒤 1초간 상세·갤러리·사이드바 GET 0건.
- [x] **Step 2: 실패**. **Step 3: 구현** `staleTime: (q) => hasActiveJobs(q.state.data) ? 0 : 60_000`, `refetchOnWindowFocus: (q) => hasActiveJobs(...)`, `initialDataUpdatedAt: Date.now()`; 갤러리·사이드바 `refetchOnWindowFocus: false`. **Step 4: 통과**.
- [x] **Step 5: 커밋** `git commit -am "수정: 활성 잡 없으면 상세·갤러리·사이드바를 다시 받지 않음"`

### Task 14: 번들 분리 (B11)

**Files:**
- Create: `src/lib/jobs/constants.ts`, `src/components/viewer/viewer-slot.tsx`
- Modify: `src/lib/jobs/schemas.ts`(상수 re-export), `src/components/chat/composer.tsx:15`, `src/components/chat/composer-options.tsx:10,16-19`, `src/components/chat/new-chat.tsx:15`, `src/components/chat/conversation-view.tsx:19`, `src/components/viewer/image-viewer-dialog.tsx:10,17`, `src/components/viewer/viewer-panel.tsx:8`, `src/components/chat/conversation-menu.tsx:9`, `src/components/gallery/gallery-grid.tsx:8`, `src/components/shell/app-shell.tsx`, `src/components/viewer/viewer-link.tsx`
- Test: `tests/imagen-local/unit/client-imports.test.ts`

**Interfaces:**
- `constants.ts`: `SEED_MAX`, `PROMPT_MAX`, `ID_RE`, `parseId`, `DETAIL_JOB_LIMIT`, `promptAlt`. `schemas.ts` 는 `export { ... } from "./constants"` 로 서버 코드 호환.
- `viewer-slot.tsx`('use client'): `const ImageViewerDialog = dynamic(() => import("./image-viewer-dialog").then(m => m.ImageViewerDialog))`, `export function preloadViewer()`; `ViewerLink` 의 `onPointerEnter`/`onFocus` 에서 `preloadViewer()`.

- [x] **Step 1: unit 테스트** `src/**/*.tsx` 중 `"use client"` 로 시작하는 파일에서 `from "@/lib/jobs/schemas"` 값 import(`import type` 제외) 0건; `styles.ts` 만 클래스 상수를 export 한다(`composer-options.tsx`·`result-card.tsx` 에 `export const *_CLASS` 없음).
- [x] **Step 2: 실패**. **Step 3: 구현**. **Step 4: 통과** + `npm run build` 뒤 `/` JS gzip 합계를 8단계 방식으로 재측정(목표 300KB 이하, 보고용).
- [x] **Step 5: 커밋** `git commit -am "정리: 클라이언트 번들에서 zod 제거, 클래스 상수 분리, 뷰어 지연 로드"`

### Task 15: 갤러리 렌더·요청 취소 (B16)

**Files:**
- Modify: `src/components/gallery/gallery-grid.tsx`, `src/components/viewer/viewer-link.tsx`, `src/components/gallery/gallery-view.tsx`, `src/components/shell/app-sidebar.tsx`, `src/components/viewer/image-viewer-dialog.tsx`, `src/lib/api-client.ts`, `src/app/globals.css`
- Test: `tests/imagen-local/e2e/perf.spec.ts`(확장)

**Interfaces:**
- `GalleryTile = memo(function GalleryTile({ img, index, onDelete }))`; `ViewerLink({ imageId, ... })` → `href={`?image=${imageId}`}`, 클릭 시 `window.location.search` 에 `image` 를 더해 `history.pushState`. `apiFetch` 는 `init.signal` 을 그대로 fetch 에 넘기고(이미 넘김) `queryFn: ({ signal }) =>` 로 전달. CSS `.gallery-tile { content-visibility: auto; contain-intrinsic-size: auto 240px }`.

- [x] **Step 1: 테스트** 갤러리 타일 computed `content-visibility === 'auto'`; 검색어를 빠르게 두 번 바꾸면 첫 `/api/images?q=` 요청이 `requestfailed`(`ERR_ABORTED`, fixture 가 허용) 또는 응답 전에 취소됨(`page.on('request')` + `request.failure()`).
- [x] **Step 2: 실패**. **Step 3: 구현**. **Step 4: 통과**.
- [x] **Step 5: 커밋** `git commit -am "수정: 갤러리 타일 memo·content-visibility, 이전 요청 취소"`

### Task 16: 정적 셸에 본문 (B18)

**Files:**
- Modify: `src/app/page.tsx`, `src/components/chat/new-chat.tsx:25-40`, `src/app/gallery/page.tsx`, `src/components/gallery/gallery-view.tsx`, `src/components/gallery/gallery-filters.tsx`
- Test: `tests/imagen-local/api/ssr.spec.ts`(확장)

**Interfaces:**
- `NewChat` 은 `useSearchParams` 대신 mount 효과에서 `new URLSearchParams(window.location.search).get("edit")` 를 읽어 `linkedId` state 로. `GalleryFilters` 도 effect 로 입력값 동기화; 목록(`GalleryList`)만 `Suspense` + `useSearchParams`.

- [x] **Step 1: 테스트** `request.get('/')` HTML 에 "무엇을 만들까요"·"FLUX 3 Klein"·"MOSS-Image" 있음, `animate-pulse` 0건; `/gallery` HTML 에 "프롬프트로 찾기" 있음; e2e `new-chat.spec.ts`·`gallery.spec.ts` 통과(`?edit=` 흐름 포함).
- [x] **Step 2: 실패**. **Step 3: 구현**. **Step 4: 통과** + `npm run build` 가 PARTIALLY_STATIC 유지.
- [x] **Step 5: 커밋** `git commit -am "수정: 홈·갤러리 본문을 정적 셸에 포함"`

### Task 17: 제출은 응답 뒤에 (B19)

**Files:**
- Modify: `src/lib/jobs/create.ts:107-155`, `src/app/api/conversations/route.ts`, `src/app/api/conversations/[id]/jobs/route.ts:33-34`, `src/lib/jobs/sync.ts:37-77,103-121`
- Test: `tests/imagen-local/api/jobs.spec.ts`(확장), `tests/imagen-local/worker/`(변경 없음)

**Interfaces:**
- `claimForSubmit(jobIds)`: `prisma.job.updateMany({ where: { id: { in }, submittedAt: null, status: "QUEUED" }, data: { submittedAt: now } })` 로 먼저 잡고, 잡힌 것만 워커에 POST(실패하면 `submittedAt: null` 로 되돌림). 라우트는 `after(() => submitJobs(ids))`(`next/server`) 뒤 201. `syncJobs` 의 완료 처리는 `Promise.all`.

- [x] **Step 1: 테스트** POST 응답의 `jobs[].submittedAt` 과 무관하게 1초 안에 `GET /api/jobs/[id]` 가 RUNNING/SUCCEEDED 로 진행; mock 워커 `/jobs` 호출 로그에 같은 id 가 두 번 없음(워커 `GET /jobs/[id]` 로 상태만 확인 가능하면 "CANCELLED 아님·중복 제출 409 없음"으로 대체).
- [x] **Step 2: 실패**. **Step 3: 구현**. **Step 4: 통과** + `api/jobs.spec.ts`·`api/worker-down.spec.ts`(offline project 는 skip 유지).
- [x] **Step 5: 커밋** `git commit -am "수정: 잡 제출을 응답 뒤로 미루고 완료 처리는 병렬로"`

### Phase 4 리뷰
- [x] 세 리뷰 → 수정 → `git commit -am "리뷰 반영: 성능"`

## Phase 5 — 일관성

### Task 18: 문구 통일 (B13)

**Files:**
- Modify: `src/app/error.tsx:34`, `src/app/global-error.tsx:25`, `src/app/not-found.tsx:22,24,29`, `src/app/c/[id]/not-found.tsx:9`, `src/components/chat/job-card.tsx:12,32-39,62`, `src/components/ui/spinner.tsx:6`, `src/components/chat/result-card.tsx:101-113`, `src/components/viewer/viewer-panel.tsx:29`, `src/components/viewer/image-viewer-dialog.tsx:76`, `src/components/ui/sidebar.tsx:199-200,275`, `src/components/ui/sonner.tsx`, `src/components/shell/app-sidebar.tsx:61`, `src/components/chat/conversation-view.tsx:182`, `src/components/gallery/gallery-grid.tsx:35`
- Test: `tests/imagen-local/unit/copy.test.ts`, e2e 기대 문구 갱신

- [x] **Step 1: unit 테스트** `src/**/*.{ts,tsx}` 의 JSX 문자열·문자열 리터럴에서 `습니다` 0건, `지워지고|지우지 못했어요|지웠거나` 0건, `job-card.tsx` 가 "대기 중…"·"생성 중…"·"고치는 중…"·"마무리하는 중…" 을 포함, `spinner.tsx` 가 "불러오는 중…", 취소 결과 "취소했어요".
- [x] **Step 2: 실패**. **Step 3: 구현**(design.md B13 표). e2e 기대 문구 갱신. **Step 4: 통과**(unit + 전체 e2e).
- [x] **Step 5: 커밋** `git commit -am "정리: 문구 통일(해요체·삭제·진행형 …·한국어 라벨)"`

### Task 19: 동작 일관성 (B15)

**Files:**
- Modify: `src/components/gallery/gallery-grid.tsx:41-45`, `src/components/chat/result-card.tsx:157-170`, `src/components/chat/job-card.tsx:34-65`, `src/components/chat/conversation-view.tsx:164-176`
- Test: `tests/imagen-local/e2e/gallery.spec.ts`·`conversation.spec.ts`(추가)

- [x] **Step 1: 테스트** 갤러리 MOSS 타일에 링크 "다른 모델로 고치기"(`/?edit=`); 결과 행 버튼 3개가 모두 `svg` 를 포함; 생성 중 "중지" 클릭 직후 버튼 텍스트 "중지하는 중…" + disabled.
- [x] **Step 2: 실패**. **Step 3: 구현**. **Step 4: 통과**.
- [x] **Step 5: 커밋** `git commit -am "수정: 갤러리 MOSS 고치기 링크, 결과 행 버튼 통일, 취소 진행 표시"`

### Phase 5 리뷰
- [x] 세 리뷰 → 수정 → `git commit -am "리뷰 반영: 일관성"`

## 마무리(8단계)
- [x] `/simplify` → 수정 커밋
- [x] 루트: `npm run qa:typecheck && npm run qa:lint && npx vitest run --config vitest.config.ts && npm run qa:imagen-local`; 앱: `npm run typecheck && npm run lint && npm run build`
- [x] production(3002) 재기동 → 핵심 흐름(새 대화 → 생성 → 삭제 → 복구) 브라우저 확인 + `/`·`/gallery`·`/c/[id]` 트레이스 재측정
- [x] 캔버스 문구 맞춤, `audit.md` 후속 백로그 갱신, `README.md` 구조 절(휴지통 라우트·trash.ts)
- [x] `git push origin feat/imagen-v3`
