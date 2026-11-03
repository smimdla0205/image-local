# imagen-local 제품 감사

프롬프트 [docs/prompt/product-audit.md](../prompt/product-audit.md) 의 1~4 단계 산출물이다. 경로는 `project/imagen-local/` 기준이고, 테스트는 `tests/imagen-local/` 기준이다.

## 감사 환경

| 항목 | 값 |
|---|---|
| 데이터 | `test.db` + `storage-test/`. 시드 17 대화·49 이미지(klein 4·qwen 4·moss 8 대화, 고치기 1회, 삭제 1회) |
| 동작 확인 | `next dev` 3000 (`npm run imagen-local:dev:test`), mock 워커 8787 |
| 성능 측정 | `next build` + `next start` 3002, Chrome DevTools 트레이스·Lighthouse, CPU·네트워크 스로틀 없음 |
| 이미지 크기 | mock 결과물은 PNG 2KB. 실제 결과물은 PNG 약 1.2MB, 화면용 preview WebP 약 80KB, 썸네일 WebP 약 30KB(`storage/` 8장 평균) |
| 증거 | `tests/reports/playwright-cli/audit/`, `tests/reports/lighthouse/audit-*/report.html` |
| 코드 읽기 | 서브에이전트 3개(파괴적 동작·데이터 수명주기 / 상태·레이아웃·접근성·일관성 / 성능). 근거는 경로:줄 |

## 1. 화면·동작 표

| 화면 | 라우트 | 할 수 있는 동작 |
|---|---|---|
| 앱 틀 | 전체 | 브랜드 링크(/), 사이드바 접기·열기(버튼, Ctrl/Cmd+B), 바로가기 "새 대화"·"갤러리", 대화 목록(날짜 묶음, 최대 60, 썸네일+제목), 모바일 "메뉴 열기"(Sheet) |
| 새 대화 | `/` | 모델 라디오 3개(Klein·Qwen Turbo·MOSS), 프롬프트 입력, "고칠 사진 올리기", 비율 메뉴, "생성 옵션"(장수·시드·투명 배경), "생성". `?edit=<imageId>` 로 고칠 이미지 칩 |
| 대화 | `/c/[id]` | 상단 제목·모델 배지·"대화 메뉴"(→ 대화 삭제 → 확인 모달). 말풍선(프롬프트, 고칠 이미지 썸네일). 결과 카드: 크게 보기·이어서 고치기·다른 모델로 고치기(MOSS)·다운로드·다시 생성·프롬프트 복사. 고친 결과: 버전 배지·비교 슬라이더. 잡 카드: 대기 중(취소)·생성 중(중지)·실패(다시 생성)·중지됨. 워커 끊김 배너. 입력창: 고칠 이미지 칩(빼기), 어떻게 고칠지, 사진 올리기, 생성 옵션, 생성 |
| 갤러리 | `/gallery` | 프롬프트 검색(`?q`), 모델 필터(`?model`), 날짜 묶음 격자, 타일: 크게 보기·이어서 고치기(가능한 모델)·다운로드, "더 보기" |
| 이미지 뷰어 | `?image=<id>` (모든 화면) | 닫기(버튼·Esc), 큰 이미지, 프롬프트·프롬프트 복사, 시드 복사, 모델·방식·크기·버전, 다운로드, 이어서 고치기·다른 모델로 고치기, 삭제(→ 확인 모달) |
| 없는 대화 | `/c/[id]` 404 | "대화를 찾을 수 없어요" + 새 대화 링크 |
| 전역 404·오류 | `not-found.tsx`, `error.tsx` | 문구 + 다시 시도 |

모달·메뉴: 대화 삭제 AlertDialog, 이미지 삭제 AlertDialog, 뷰어 Dialog, 모바일 Sheet, 생성 옵션 Popover, 비율 메뉴, 모델 Select, 대화 메뉴 Dropdown. 모두 Esc 로 닫힌다.

## 2. 렌즈별 발견

### 상태 가시성

| 영역 | 로딩 | 빈 | 오류 | 삭제됨 | 근거 |
|---|---|---|---|---|---|
| 사이드바 목록 | 스켈레톤 5줄 | `<p>` "아직 대화가 없어요", 행동 없음 | `<p>` "목록을 불러오지 못했어요", 재시도 없음 | 해당 없음 | `src/components/shell/app-sidebar.tsx:34-52` |
| 대화 첫 로딩 | ThreadSkeleton(Suspense) | 해당 없음 | 전역 error.tsx | 404 "대화를 찾을 수 없어요" | `src/app/c/[id]/page.tsx:11,22` |
| 대화 폴링 | initialData 라 없음 | 해당 없음 | `isError` 분기 없음. 폴링 실패·서버 끊김·다른 탭 삭제(404) 모두 조용하고 진행 카드가 남는다 | 지운 이미지는 "삭제한 이미지예요" 글자 한 줄 | `src/components/chat/conversation-view.tsx:35-64`, `thread.tsx:31`, `result-card.tsx:67` |
| 잡 카드 | 대기(앞에 N건)·n/m step·마무리·15초 뒤 "GPU를 깨우는 중" | 해당 없음 | 실패 카드 + 다시 생성, 워커 배너 "GPU 워커에 연결할 수 없어요" | 해당 없음 | `src/components/chat/job-card.tsx`, `worker-banner.tsx` |
| 갤러리 | 8칸 스켈레톤, 필터 변경 시 흐림 | `<p>` "찾는 이미지가 없어요"/"아직 만든 이미지가 없어요", 행동 없음 | 첫 페이지 `<p>` 재시도 없음, 다음 페이지는 더 보기로 재시도 | 목록에서 사라짐 | `src/components/gallery/gallery-view.tsx:20-28,73-102` |
| 뷰어 | 캐시면 즉시, 딥링크는 스피너(스켈레톤 아님) | 해당 없음 | 한 줄 문구, 재시도 없음 | 404 "이미지를 찾을 수 없어요" | `src/components/viewer/image-viewer-dialog.tsx:39-47,81-88` |
| 새 대화 `?edit=` | 없음 | 해당 없음 | 없음(잘못된 id 도 조용) | 없음 | `src/components/chat/new-chat.tsx:33-40` |
| 업로드 | 클립 버튼 스피너만(칩 자리·진행 없음) | 해당 없음 | 토스트 | 해당 없음 | `src/components/chat/composer.tsx:141-150` |
| 제출·삭제 진행 | 제출 스피너, 삭제는 버튼 disabled 만 | 해당 없음 | 토스트 | 해당 없음 | `composer.tsx:166-173`, `conversation-menu.tsx:76` |
| 스켈레톤 공통 | 4세트 모두 `aria-hidden`, `aria-busy`·낭독 문구 없음 | | | | `app-sidebar.tsx:36`, `new-chat.tsx:79`, `conversation-view.tsx:204`, `gallery-view.tsx:115` |

### 파괴적 동작

| 동작 | 확인 모달 | 함께 사라지는 것 안내 | 복구 | 근거 |
|---|---|---|---|---|
| 대화 삭제 | 있음. "대화를 삭제할까요? 이미지도 함께 지워지고 되돌릴 수 없어요." | 장수·진행 중 잡·다른 대화가 원본으로 쓰는 이미지 언급 없음 | 없음. 성공 토스트 없음, 캐시(detail·images.detail) 안 지움 | `src/components/chat/conversation-menu.tsx:68-81`, 증거 `B02-delete-modal.png` |
| 이미지 삭제 | 있음. "이미지를 삭제할까요? 삭제하면 되돌릴 수 없어요." | 고친 버전·입력으로 쓴 요청 언급 없음 | 없음. 실패해도 모달이 닫힌다 | `src/components/viewer/viewer-panel.tsx:121-141`, `image-viewer-dialog.tsx:56-70` |
| 잡 취소·중지 | 없음(적절) | 해당 없음 | 해당 없음. pending 표시 없음, 실행 중 잡은 다음 폴링까지 "중지" 버튼이 남는다 | `src/components/chat/job-card.tsx:34-65` |
| 고칠 사진 교체·칩 빼기 | 없음(비파괴) | 해당 없음 | 해당 없음. 올라간 파일은 서버에 남는다 | `composer.tsx:100-125` |
| 재시도 경로 | 해당 없음 | | | |

### 데이터 수명주기

| 영역 | 현상 | 근거 |
|---|---|---|
| 대화 삭제 → 행 | Job·Image 가 cascade 로 지워진다. 정상 경로에서 고아 행 없음 | `prisma/schema.prisma:36,56,76-78`, `src/app/api/conversations/[id]/route.ts:21-35` |
| 대화 삭제 → 파일 | 요청 초반에 읽은 image id 로 images·thumbs·previews 3종을 지운다. 워커 취소 대기(최대 15초) 사이에 생긴 이미지는 파일이 남고, `allSettled` 라 삭제 실패가 로그 없이 묻힌다 | `route.ts:21-27,34-35`, `src/lib/storage/index.ts:79-82` |
| 대화 삭제 → 워커 잡 | `submittedAt` 이 있는 활성 잡에만 취소를 보내고 실패는 무시한다. 제출 중(최대 4건 순차)에 지우면 그 잡은 취소되지 않고 GPU 가 끝까지 돈다 | `route.ts:24,31-32`, `src/lib/jobs/create.ts:107-153`, `src/lib/jobs/sync.ts:108-115` |
| 이미지 삭제 → 참조 | `Job.inputImageId`·`Image.parentId` 는 SetNull. 말풍선·결과 카드에 "삭제한 이미지예요" 자리표시자가 있어 깨지지 않는다. 비교 슬라이더는 빠진다. 입력이 지워진 고치기의 "다시 생성"이 이유 없이 사라지고, 결과 영역 aria-label 이 "만든 이미지 0장"이 된다 | `src/components/chat/thread.tsx:24-32`, `result-card.tsx:66-68,94-97,145`, 증거 `B01-placeholder.png` |
| 다른 대화의 참조 | MOSS "다른 모델로 고치기"는 새 대화 B 가 대화 A 의 이미지를 `inputImageId` 로 참조한다(복사 아님). A 를 지우면 B 의 입력이 사라지고 모달은 이를 말하지 않는다 | `src/components/chat/new-chat.tsx:33-49`, `create.ts:37-40` |
| 고칠 이미지 칩 | 대상 이미지를 뷰어에서 지워도 칩(`manualTarget`)이 남고, 보내면 400 토스트 | `conversation-view.tsx:77,116-119` |
| 쓰지 않은 업로드 | `conversationId=null` 행과 파일 3종이 영구히 남는다. 정리 코드 없음 | `src/app/api/uploads/route.ts:68-73`, `create.ts:47-50` |
| 소프트 삭제 | `deletedAt`·복구 API·휴지통 화면 없음. `/trash`·`/api/trash` 404 | 증거 `B13-no-trash.txt` |
| 워커 Volume | 입력·결과 파일을 지우는 코드가 `gpu/` 에 없다 | `gpu/worker/modal_backend.py:50-59,111-118` |

### 개별 제어

| 동작 | 현상 | 근거 |
|---|---|---|
| 이미지 삭제 | 뷰어에서만 된다. 대화 결과 카드·갤러리 타일에는 없다 | 증거 `B12-tile-actions.txt` |
| 잡(요청) 삭제 | 없음. 실패·중지 카드가 영구히 남는다. 범위 밖(후속) | `src/app/api/jobs/[id]/route.ts:28-32` |
| 다중 선택 | 없음. 범위 밖(후속) | |
| 장수·시드·비율 | 요청 단위로 고를 수 있다. 해당 없음 | |

### 레이아웃 유연성

| 영역 | 현상 | 근거 |
|---|---|---|
| 사이드바 너비 | `16rem` 고정. 드래그 조절 없음. `SidebarRail` 은 정의만 있고 토글 버튼이다 | `src/components/ui/sidebar.tsx:30-32,280-303`, 증거 `B07-B11-sidebar-eval.txt` |
| 접기 유지 | 쿠키 `sidebar_state` 를 쓰기만 하고 읽지 않는다. 새로고침하면 항상 펼쳐진다 | `ui/sidebar.tsx:85-86`, `app-shell.tsx:10`, 증거 `B06-sidebar-after-reload.png` |
| 접힌 상태 | `inert`·`visibility` 없이 왼쪽으로 밀기만 해 Tab 이 안 보이는 링크로 들어간다. 접은 뒤 포커스 이동 없음 | 증거 `B11-collapsed-focusable.txt` (`left:-248, inert:false, tabIndex:0`) |
| 좁은 화면 | 768px 미만은 Sheet. 열기 버튼 44px. error·not-found 에는 메뉴 버튼이 없다 | `src/hooks/use-mobile.ts`, `topbar.tsx:17` |
| 본문·뷰어 | 대화 `max-w-205` 중앙, 갤러리 전체 폭, 뷰어 3:2. 패널 크기 조절은 해당 없음 | |
| 긴 제목 | `truncate` + `title`. 전체 제목은 마우스 hover 에만 보인다 | `app-sidebar.tsx:68,80` |

### 성능

측정값(production 빌드, 로컬, 스로틀 없음):

| 화면 | LCP | 내역 | CLS | 비고 |
|---|---|---|---|---|
| `/` | 458ms | TTFB 9 + render delay 450 (LCP 는 h2 글자) | 0 | 정적 셸에 본문이 없고 스켈레톤만 있어(`useSearchParams`) hydration 뒤에 그려진다. 증거 `B20-static-shell.txt` |
| `/gallery` | 603ms | TTFB 12 + load delay 349 + render delay 241 (LCP 는 첫 타일) | 0 | 첫 페이지를 클라이언트가 받고 타일이 전부 `loading=lazy` |
| `/c/[id]` (4장) | 767ms | TTFB 7 + load delay 133 + load 41 + render delay 586 | 0 | SSR 된 img 4장 모두 `data-loading` → `opacity:0`, hydration 뒤에야 보인다. 증거 `B04-ssr-data-loading.txt` |

| 항목 | 값 | 근거 |
|---|---|---|
| INP(로컬) | 최악 96ms(뷰어 열기 pointer 이벤트), 검색 입력·필터는 16ms 미만 | PerformanceObserver event, 49장 |
| 첫 로드 JS | 14~15 스크립트, 전송 gzip 합계 334KB(`/`)·335KB(`/gallery`)·339KB(`/c/[id]`). 비압축 1.05MB | 증거 `B08-bundle.txt` |
| 번들 구성 | zod 전체가 모든 라우트에(약 26KB gz, `schemas.ts` 를 클라이언트가 import), 클래스 상수 export 때문에 갤러리에 ResultCard·JobCard·CompareSlider 청크(9KB gz), 뷰어·AlertDialog 가 모든 라우트 초기 JS 에(9KB gz) | `src/lib/jobs/schemas.ts:2`, `composer-options.tsx:16-19`, `result-card.tsx:19-20`, `app-shell.tsx:5,13-15` |
| Legacy JS | 13.9KB 폴리필 | 트레이스 LegacyJavaScript |
| Lighthouse | 접근성·Best Practices·SEO 100 (3 화면) | `tests/reports/lighthouse/audit-*/` |
| 이미지 | 사이드바 24px 칸에 512px 썸네일(최대 60장, 실데이터 약 22KB×60). 입력 말풍선 썸네일 eager. 결과·갤러리 타일 전부 lazy, 첫 행·마지막 배치 우선순위 없음. `srcset` 없음. 뷰어는 preview + `fetchpriority=high` 로 적절 | 증거 `B05-img-attrs.txt`, `thread.tsx:27`, `gallery-grid.tsx:31` |
| 데이터 | 대화 상세 `staleTime: 0` 이라 SSR 직후와 창 포커스마다 100잡 전체 재조회. 갤러리 무한 쿼리는 포커스마다 모든 페이지 재조회. 요청 취소(`signal`) 없음 | `conversation-view.tsx:55-57`, `gallery-view.tsx:39-53`, `src/lib/api-client.ts:24-32`, 증거 `B09-requests.txt` |
| 서버 | 제출이 잡마다 워커 POST 를 순차 await 한 뒤 201(4장이면 RTT×4). 완료 처리(다운로드+sharp)가 폴링 응답 안에서 직렬. 사이드바 목록 `include images take:1` 이 대화별 이미지를 읽는다(추정). 폴링 틱마다 활성 잡 수만큼 워커 GET | `create.ts:138-155`, `sync.ts:37-77,103-121`, `queries.ts:102-110` |
| 갤러리 렌더 | 가상화·`content-visibility` 없음. 뷰어를 열 때마다 격자 전체가 다시 그려진다(타일 비 memo, 타일마다 `URLSearchParams`). 더 보기로 DOM 누적(타일 약 15~20노드) | `gallery-grid.tsx:16-27`, `gallery-view.tsx:34,80` |
| API 페이지 | 갤러리 `limit` 기본·최대 60, 커서. 49장 응답 28KB. 사이드바 최대 60. 상세 최근 100잡 | `src/app/api/images/route.ts:8-17`, `schemas.ts:37-46` |
| 파일 서빙 | `Cache-Control: private, max-age=31536000, immutable`, 파일명=id 라 적절 | `src/app/api/files/[kind]/[file]/route.ts` |
| 폰트·CSS | 렌더 차단 CSS 2개(Tailwind 15KB gz, Pretendard `@font-face` 100개 15KB gz). preload 없음 | `src/app/layout.tsx:7-14` |
| 가상화 필요 여부 | 사이드바(≤60)·스레드(≤100잡)는 서버 상한이 있어 해당 없음. 갤러리만 수백 장에서 필요 | |

### 접근성·키보드

| 영역 | 현상 | 근거 |
|---|---|---|
| 모달 Esc·포커스 복귀 | 뷰어·확인 모달·Sheet 모두 Esc 로 닫히고 Base UI `returnFocus` 가 있다. 뷰어는 열 때 push, 닫을 때 replace 라 뒤로가기가 한 칸 남는다 | `viewer-link.tsx:12`, `image-viewer-dialog.tsx:53,74` |
| 이름·alt | 아이콘 버튼 전부 `aria-label`. 결과·갤러리·뷰어 alt 가 프롬프트 전체(최대 4000자), 한 배치 N장이 같은 alt | `result-card.tsx:54`, `gallery-grid.tsx:31` |
| 영어 잔재 | Sheet 제목·설명 "Sidebar"/"Displays the mobile sidebar.", Sonner "Notifications alt+T", SidebarTrigger sr-only "Toggle Sidebar" | `ui/sidebar.tsx:199-200,275`, `ui/sonner.tsx` |
| 키보드 이동 | skip link 없음(Tab 정지점 약 64개). 접힌 사이드바 링크에 Tab 진입. 갤러리 타일당 3정지점, 방향키 없음 | 증거 `B07-B11-sidebar-eval.txt`, `gallery-grid.tsx:30,38-48` |
| 포커스 링 | 3종 혼재: `shadow-focus-ring`(signal), shadcn `ring-ring/50`, 사이드바 `ring-sidebar-ring`. 프롬프트 입력창은 회색 테두리뿐 | `src/app/globals.css:132`, `ui/button.tsx:6`, `composer.tsx:123,138` |
| sticky 가림 | Topbar·입력창이 sticky 인데 `scroll-padding` 없음 | `topbar.tsx:16`, `conversation-view.tsx:187` |
| 라이브 영역 | 토스트 polite, 배너 alert. 잡 카드 `role=status` 안 step 숫자가 1.5초마다 바뀐다. 스켈레톤·업로드는 낭독 안 됨 | `job-card.tsx:55` |
| 랜드마크 | error·not-found 가 `<main>` 안에 `<main>` 을 또 그리고 제목이 heading 이 아니다 | `src/app/error.tsx:28`, `not-found.tsx:16` |
| 모션 | Skeleton·이미지 페이드는 reduced-motion 처리. Spinner·사이드바 접기·Dialog 는 미처리 | `ui/sidebar.tsx:221,233` |
| 대비·탭 타겟 | Lighthouse 접근성 100, 모바일 메뉴 44px. 해당 없음 | |

### 오류 복구

| 영역 | 현상 | 근거 |
|---|---|---|
| 워커 끊김 | 배너 "GPU 워커에 연결할 수 없어요. 연결되면 이어서 진행해요." + 잡 "대기 중"(취소). 워커가 돌아오면 자동 제출 | 브라우저 확인(워커 종료 후 생성) |
| 생성 실패 | 실패 카드 + 서버 문구 + "다시 생성" | `job-card.tsx:44-49` |
| API 실패 | 사이드바·갤러리 `<p>` 한 줄, 재시도 버튼 없음. 콘솔 500 외 사용자에게 재시도 경로 없음 | 증거 `B10-gallery-sidebar-500.png` |
| 폴링 실패 | 표시 없음, 카드가 "생성 중"으로 남는다 | `conversation-view.tsx:35-64` |
| 전역 오류 | `error.tsx` 의 `reset()` 은 서버에서 다시 받지 않고(Next 16.4 는 `retry()` 권장), 이동 링크·모바일 메뉴 없음 | `src/app/error.tsx:16-18,41` |
| 복사 실패 | 토스트 2종 문구가 다르다 | `result-card.tsx:113`, `viewer-panel.tsx:58` |

### 일관성

| 영역 | 현상 | 근거 |
|---|---|---|
| 삭제 동사 | "삭제"·"지워지고"·"지우지 못했어요"·"지웠거나"·"삭제한 이미지예요" 혼용 | 증거 `B14-copy-grep.txt` |
| 문체 | 합쇼체 4줄(`error.tsx:34`, `global-error.tsx:25`, `not-found.tsx:22,24`) | 증거 `B14-copy-grep.txt` |
| 생성/만들기 | 갤러리 배지 "생성/고침" vs 대화 배지 "텍스트→이미지/이어서 고치기". "새 대화" vs "새 채팅으로". "제목 없음" vs "대화" | `gallery-grid.tsx:35`, `result-card.tsx:106`, `app/not-found.tsx:29`, `app-sidebar.tsx:61` |
| 진행형 "…" | 로딩·진행 문구에 "…" 0건("대기 중", "생성 중", "불러오는 중") | `job-card.tsx:32-39`, `ui/spinner.tsx:6` |
| 취소/중지 | 대기는 "취소", 진행은 "중지"인데 결과는 둘 다 "중지했어요" | `job-card.tsx:62` |
| 타일 동작 | 갤러리 MOSS 타일에 "다른 모델로 고치기" 없음(대화 타일·뷰어에는 있음). 결과 행 "다른 모델로 고치기"만 outline·아이콘 없음 | `gallery-grid.tsx:41-45`, `result-card.tsx:157-170` |
| 뷰어 제목 | 진입은 "크게 보기", 제목은 "이미지 자세히 보기" | `image-viewer-dialog.tsx:76` |
| 오류 모양 | 같은 문구가 사이드바(왼쪽)와 갤러리(가운데)에서 다른 모양. 404 가 3종 | `app-sidebar.tsx:51`, `gallery-view.tsx:75` |
| 통과 | 크게 보기·다운로드·이어서 고치기·프롬프트 복사는 자리·문구·아이콘이 같다. 이모지·느낌표·12px 미만 글자 0건 | |

## 3. 백로그

영향 높고 난이도 낮은 순. 씨앗 항목은 S 번호로 표시한다. 증거는 `tests/reports/playwright-cli/audit/` 기준이다.

| # | 현상 | 기대 동작 | 렌즈 | 영향 | 난이도 | 손댈 파일 | 수용 기준 | 증거 |
|---|---|---|---|---|---|---|---|---|
| B1 (S2) | 대화 삭제 모달이 "이미지도 함께 지워지고"만 말한다 | 모달이 이미지 수·진행 중 잡 수·다른 대화의 참조를 숫자로 말한다. 성공 시 토스트와 사이드바 즉시 반영 | 파괴적 동작 | 상 | 하 | `src/lib/jobs/queries.ts`, `schemas.ts`(ConversationDetailDto 에 counts), `conversation-menu.tsx` | (1) 모달 본문에 "이미지 N장도 함께 삭제돼요"(N = 그 대화의 생성·고침 이미지 수) (2) 진행 중 잡이 있으면 "진행 중 K건을 중단해요", 다른 대화가 원본으로 쓰면 "다른 대화 M건이 이 이미지를 원본으로 써요" (3) 삭제 성공 시 "대화를 삭제했어요" 토스트가 뜨고 사이드바에서 그 대화가 즉시 사라진다 | `B02-delete-modal.png` |
| B2 (S5) | 지운 이미지 자리가 글자 한 줄이고 사유·틀이 없다. aria-label 이 "만든 이미지 0장" | 원래 비율의 틀 + 아이콘 + "삭제한 이미지예요" + 사유. 라벨은 실제 장수 | 데이터 수명주기 | 상 | 하 | `result-card.tsx`, `thread.tsx`, 새 `components/chat/deleted-image.tsx` | (1) 결과가 지워진 자리에 원래 비율(잡의 width·height)의 틀과 "삭제한 이미지예요"가 보인다 (2) 입력이 지워진 고치기 말풍선은 "원본을 삭제해서 다시 고칠 수 없어요"를 보인다 (3) 결과 영역 aria-label 이 남은 장수("만든 이미지 1장")다 | `B01-placeholder.png` |
| B3 | SSR 된 결과 이미지가 hydration 전까지 투명해 `/c/[id]` LCP render delay 586ms | 서버가 그린 이미지는 바로 보이고, 페이드는 클라이언트가 새로 받는 이미지에만 | 성능 | 상 | 하 | `src/components/fade-image.tsx`, `src/app/globals.css:200-203` | (1) `/c/[id]` SSR HTML 의 `<img>` 에 `data-loading` 이 없다 (2) 클라이언트에서 새로 받는 이미지는 받는 동안 투명·틀 깜빡임 그대로 (3) production 트레이스에서 `/c/[id]` LCP render delay 가 150ms 이하(보고용) | `B04-ssr-data-loading.txt` |
| B4 | 이미지 우선순위 없음: 갤러리 첫 행 lazy, 마지막 배치 lazy, 사이드바 24px 에 512px 썸네일 60장 eager, 입력 말풍선 eager | 보이는 것 먼저, 작은 것은 낮게 | 성능 | 상 | 하 | `gallery-grid.tsx`, `result-card.tsx`, `compare-slider.tsx`, `app-sidebar.tsx`, `thread.tsx` | (1) 갤러리 첫 8장은 `loading=eager`, 첫 4장은 `fetchpriority=high`, 나머지 lazy (2) 대화 마지막 배치의 결과 이미지는 eager + high (3) 사이드바 썸네일은 `loading=lazy` + `fetchpriority=low`, 입력 말풍선 썸네일은 lazy | `B05-img-attrs.txt` |
| B5 (S1) | 사이드바 접기 상태가 새로고침에 풀린다(쿠키 쓰기만) | 접힌 상태가 새로고침·새 탭에서 유지되고 첫 페인트부터 접혀 있다 | 레이아웃 | 상 | 하 | `ui/sidebar.tsx`, `app-shell.tsx`, `src/app/layout.tsx`(인라인 스크립트), `globals.css` | (1) 접고 새로고침하면 접힌 채다 (2) 새 탭에서도 같다 (3) hydration 전 첫 페인트에서도 접혀 있다(펼침→접힘 깜빡임 없음) | `B06-sidebar-after-reload.png` |
| B6 | 대화 상세 `staleTime 0` 으로 SSR 직후·포커스마다 100잡 재조회, 갤러리·사이드바도 포커스마다 재조회 | 활성 잡이 없으면 다시 받지 않는다 | 성능 | 상 | 하 | `conversation-view.tsx`, `gallery-view.tsx`, `app-sidebar.tsx` | (1) 활성 잡이 없는 대화에 들어가면 SSR 뒤 `GET /api/conversations/[id]` 를 다시 부르지 않는다 (2) 활성 잡이 있으면 기존 폴링 그대로 (3) 창 포커스 때 활성 잡이 없으면 상세·갤러리·사이드바를 다시 받지 않는다 | `B09-requests.txt` |
| B7 (S6) | 스켈레톤 빈틈: 뷰어 딥링크 스피너, 업로드 칩, `?edit=` 대상, 더 보기. 스켈레톤이 낭독되지 않는다 | 비동기 영역 전부 자리 모양 스켈레톤 + `aria-busy` + 한 번 낭독 | 상태 가시성 | 상 | 하 | `image-viewer-dialog.tsx`, `composer.tsx`, `new-chat.tsx`, `gallery-view.tsx`, `ui/skeleton.tsx`, 4 스켈레톤 | (1) 뷰어 딥링크 로딩 중 이미지 비율 틀과 패널 줄 스켈레톤이 보이고 `role=status` "불러오는 중…"이 있다 (2) 업로드 중 칩 자리에 스켈레톤과 "올리는 중…" (3) `?edit=` 대상 로딩 중 칩 자리 스켈레톤, 404 면 "고칠 이미지를 찾을 수 없어요" (4) 모든 스켈레톤 컨테이너가 `aria-busy=true` 이고 sr-only "불러오는 중…"을 한 번 낭독한다 | `B03-viewer-deeplink.txt` |
| B8 (S4) | 이미지 삭제가 뷰어에서만 되고, 실패해도 모달이 닫힌다 | 결과 카드·갤러리 타일에서도 삭제. 실패 시 모달 유지, 진행 표시 | 개별 제어 | 상 | 중 | `result-card.tsx`, `gallery-grid.tsx`, `viewer-panel.tsx`, `image-viewer-dialog.tsx`, 새 `components/image-delete-dialog.tsx`(공용), `conversation-view.tsx` | (1) 대화 결과 카드와 갤러리 타일 동작에 "삭제"가 있고 누르면 뷰어와 같은 확인 모달이 뜬다 (2) 삭제 실패 시 모달이 열린 채 오류 토스트가 뜬다 (3) 진행 중 확인 버튼이 "삭제하는 중…"으로 바뀌고 비활성이다 (4) 삭제한 이미지가 고칠 이미지 칩이면 칩이 빠진다 | `B12-tile-actions.txt` |
| B9 | 오류에 재시도가 없고 폴링 실패·다른 탭 삭제가 조용하다. `error.tsx` 는 `reset()` 이고 이동 링크가 없다 | 오류마다 재시도 버튼, 끊김 표시, 404 안내 | 오류 복구 | 상 | 중 | `app-sidebar.tsx`, `gallery-view.tsx`, `image-viewer-dialog.tsx`, `conversation-view.tsx`, `worker-banner.tsx`, `src/app/error.tsx`, 새 `components/ui/load-error.tsx` | (1) 사이드바·갤러리 첫 페이지·뷰어 오류에 "다시 불러오기" 버튼이 있고 누르면 다시 요청한다 (2) 대화 폴링이 실패하면 `role=status` "연결이 끊겼어요. 다시 시도하는 중…"이 보이고, 404 면 "삭제된 대화예요" + 새 대화 링크가 보이며 폴링이 멈춘다 (3) `error.tsx` 가 `retry` 로 서버에서 다시 받고 "새 대화로" 링크가 있다 | `B10-gallery-sidebar-500.png` |
| B10 (S1) | 사이드바 너비를 바꿀 수 없다 | 가장자리 드래그·키보드로 12~24rem 조절, 유지 | 레이아웃 | 상 | 중 | `ui/sidebar.tsx`(SidebarRail → 드래그 핸들, width 상태), `app-sidebar.tsx`, `app-shell.tsx`, `globals.css` | (1) 사이드바 오른쪽 가장자리를 드래그하면 너비가 12~24rem 사이에서 바뀌고 본문이 따라온다 (2) 핸들은 `role=separator` `aria-orientation=vertical` `aria-valuenow` 이고 방향키로 16px 씩, 더블클릭은 기본값 (3) 새로고침·새 탭에서 너비가 유지된다 | `B07-B11-sidebar-eval.txt` |
| B11 | 모든 라우트 첫 로드 JS gzip 334KB. zod 전체·클래스 상수 결합·뷰어 정적 포함 | 클라이언트에서 zod 제거, 결합 끊기, 뷰어 지연 로드 | 성능 | 상 | 중 | 새 `src/lib/jobs/constants.ts`, `schemas.ts`, `composer.tsx`, `composer-options.tsx`, `new-chat.tsx`, `conversation-view.tsx`, `image-viewer-dialog.tsx`, 새 `src/components/chat/styles.ts`, `result-card.tsx`, `gallery-grid.tsx`, `app-shell.tsx` | (1) `'use client'` 파일은 `@/lib/jobs/schemas` 를 import 하지 않는다(테스트가 검사) (2) `/gallery` 초기 JS 에 ResultCard·JobCard·CompareSlider 가 없다 (3) 뷰어 코드는 `?image=` 가 있거나 타일 hover/focus 때 받는다 (4) `/` JS gzip 합계 300KB 이하(보고용) | `B08-bundle.txt` |
| B12 (S3) | 영구 삭제뿐. undo·휴지통 없음. 삭제 시 활성 잡 취소 누락(`submittedAt` 조건)·취소 실패 무시. 쓰지 않은 업로드 고아 | 대화·이미지를 휴지통으로 옮기고 복구·비우기·30일 자동 정리 | 파괴적 동작·데이터 수명주기 | 상 | 상 | `prisma/schema.prisma`(+마이그레이션), `queries.ts`, `schemas.ts`, `create.ts`, `sync.ts`, `storage/index.ts`, `api/conversations/[id]/route.ts`, `api/images/[id]/route.ts`, `api/images/route.ts`, 새 `api/trash/route.ts`·`api/trash/purge`·`restore` 라우트, `conversation-menu.tsx`, `viewer-panel.tsx`, `image-viewer-dialog.tsx`, 새 `src/app/trash/page.tsx`·`components/trash/*`, `app-sidebar.tsx`, `query-keys.ts`, `tests/imagen-local/support/api.ts` | (1) 대화·이미지 삭제는 `deletedAt` 을 찍고 사이드바·갤러리·상세·뷰어에서 사라지며 파일은 남는다 (2) `/trash` 에서 항목을 보고 "복구"하면 원래 자리로 돌아온다(대화는 이미지 포함) (3) 삭제 토스트의 "되돌리기"로 즉시 복구된다 (4) "비우기"와 30일 지난 항목 정리가 행과 파일 3종을 지우고, 휴지통 대화의 활성 잡은 `submittedAt` 과 무관하게 전부 취소 요청된다 (5) 휴지통 이미지는 고칠 이미지로 쓸 수 없다(400) (6) 대화 없는 업로드는 24시간 뒤 정리된다 | `B13-no-trash.txt` |
| B13 | 문구 불일치: 합쇼체 4줄, 삭제/지우, 생성/만들기, 취소/중지, 진행형 "…" 없음, 영어 sr-only | 해요체·"삭제"·"…"·한국어로 통일 | 일관성 | 중 | 하 | `error.tsx`, `global-error.tsx`, `not-found.tsx`, `c/[id]/not-found.tsx`, `conversation-menu.tsx`, `job-card.tsx`, `ui/spinner.tsx`, `gallery-grid.tsx`, `result-card.tsx`, `viewer-panel.tsx`, `image-viewer-dialog.tsx`, `ui/sidebar.tsx`, `ui/sonner.tsx`, `app-sidebar.tsx` | (1) `src` UI 문자열에 "습니다"가 0건 (2) 삭제 문구가 "삭제"로 통일돼 "지워지고"·"지우지 못했어요"·"지웠거나"가 0건 (3) 진행형 상태 문구가 "…"로 끝난다("대기 중…", "생성 중…", "불러오는 중…") (4) 취소한 잡은 "취소했어요", 복사 실패 토스트는 한 문구 (5) Sheet 제목 "메뉴", Sonner 영역 "알림", 뷰어 제목 "크게 보기" | `B14-copy-grep.txt` |
| B14 | 빈 상태가 `<p>` 한 줄이고 다음 행동이 없다 | 공통 Empty + 행동 버튼 | 상태 가시성 | 중 | 하 | `app-sidebar.tsx`, `gallery-view.tsx`, `ui/empty.tsx` | (1) 사이드바 빈 상태에 "새 대화" 링크가 있다 (2) 갤러리 빈 상태는 검색·필터 중이면 "필터 지우기" 버튼, 아니면 "새 대화" 링크가 있다 (3) 사이드바·갤러리 오류·빈 상태가 같은 Empty 컴포넌트를 쓴다 | `B18-gallery-empty.png` |
| B15 | 갤러리 MOSS 타일에 다른 모델로 고치기 없음, 결과 행 버튼 스타일 혼재, 취소·중지 pending 없음 | 같은 동작은 같은 자리·같은 모양 | 일관성 | 중 | 하 | `gallery-grid.tsx`, `result-card.tsx`, `job-card.tsx`, `conversation-view.tsx` | (1) 갤러리 MOSS 타일에 "다른 모델로 고치기" 링크가 있다 (2) 결과 행의 버튼이 모두 ghost + 아이콘이다 (3) 취소·중지를 누르면 즉시 "중지하는 중…"으로 바뀌고 비활성이다 | `B15-gallery-moss-tile.txt` |
| B16 | 뷰어를 열 때마다 갤러리 격자 전체 리렌더, `content-visibility` 없음, 요청 취소 없음 | 타일은 그대로, 화면 밖 타일은 그리지 않음, 이전 요청 취소 | 성능 | 중 | 하 | `gallery-grid.tsx`, `viewer-link.tsx`, `gallery-view.tsx`, `src/lib/api-client.ts`, `globals.css` | (1) 갤러리 타일의 computed `content-visibility` 가 `auto` 이고 `contain-intrinsic-size` 가 있다 (2) 필터를 바꾸면 이전 `/api/images` 요청이 취소된다 (3) 타일이 memo 이고 href 를 클릭 시 계산해 `?image=` 변경에 타일이 다시 그려지지 않는다 | 코드 근거 |
| B17 | 접근성: 접힌 사이드바 Tab 진입, skip link 없음, scroll-padding 없음, 포커스 링 3종, alt 4000자, 영어 라벨 | 키보드로만 써도 막히지 않는다 | 접근성 | 중 | 하 | `ui/sidebar.tsx`, `src/app/layout.tsx`, `globals.css`, `ui/button.tsx`, `ui/input.tsx`, `ui/textarea.tsx`, `composer.tsx`, `result-card.tsx`, `gallery-grid.tsx`, `image-viewer-dialog.tsx`, `ui/sonner.tsx` | (1) 접힌 사이드바는 `inert` 라 Tab 이 들어가지 않고, 접으면 포커스가 "사이드바 열기"로 간다 (2) 첫 Tab 에 "본문으로 건너뛰기" 링크가 보인다 (3) `html` 에 `scroll-padding-top/bottom` 이 있다 (4) 포커스 링이 `shadow-focus-ring` 하나로 통일되고 프롬프트 입력창도 signal 링이다 (5) 결과·갤러리·뷰어 alt 는 프롬프트 앞 80자 + "(n/N)" | `B11-collapsed-focusable.txt` |
| B18 | 정적 셸에 본문이 없어 홈·갤러리가 매번 스켈레톤을 거친다(홈 LCP render delay 450ms) | 히어로·모델 카드·검색창은 셸에, `useSearchParams` 는 작은 섬으로 | 성능 | 중 | 중 | `src/app/page.tsx`, `new-chat.tsx`, `gallery/page.tsx`, `gallery-view.tsx`, `gallery-filters.tsx` | (1) `/` SSR HTML 에 "무엇을 만들까요"와 모델 카드 3개가 있다 (2) `/gallery` SSR HTML 에 "프롬프트로 찾기"가 있다 (3) 홈 첫 로드에 스켈레톤이 보이지 않는다 | `B20-static-shell.txt` |
| B19 | 제출이 워커 POST 를 순차 await 한 뒤 응답(4장이면 RTT×4), 완료 처리 직렬 | DB 저장 직후 응답하고 제출은 응답 뒤에 | 성능 | 중 | 중 | `src/app/api/conversations/[id]/jobs/route.ts`, `src/app/api/conversations/route.ts`, `create.ts`, `sync.ts` | (1) `POST .../jobs` 가 DB 저장 직후 201 을 돌려주고 워커 제출은 응답 뒤(`after`)에 진행되며, 다음 동기화가 미제출 잡을 보낸다 (2) 완료 처리가 여러 건이면 병렬이다 | 코드 근거 |

### 후속 백로그(이번 범위 밖)

- 요청(잡) 단위 숨기기·삭제, 다중 선택 삭제
- 사이드바 썸네일 전용 작은 변형(64px)과 `srcset`, Pretendard 서브셋 preload
- 사이드바 목록 `thumbImageId` 비정규화(쿼리 측정 뒤)
- 워커 `GET /jobs?ids=` 배치, 워커 Volume 정리
- 갤러리 수백 장 가상화(측정 뒤), `/api/images?q=` 인덱스(1만 장 뒤)
- 뷰어 닫기 히스토리(`history.back()`), 갤러리 격자 방향키 이동
- 활성 잡이 없는 대화 상세는 60초 동안 다시 받지 않아 다른 탭·기기에서 지운 이미지가 그 사이 남아 보인다(뷰어는 404 를 안내). 탭 간 동기화가 필요하면 BroadcastChannel 로 무효화
- 취소·중지한 잡의 문구는 누른 버튼을 기억해 가르고, 새로고침 뒤에는 step(0 이면 취소)으로 가른다. 정확히 가르려면 JobDto 에 취소 시점 상태가 필요
- 잡 중복 제출 방지는 한 프로세스 안의 in-flight 맵이다. 앱을 여러 프로세스로 띄우면 DB 선점(submittedAt)과 워커 404 유예가 필요
- 대화 상세의 `counts`(삭제 확인창용)는 상세를 읽을 때마다 쿼리 3개를 더 쓴다. 이미지 `refs` 처럼 확인창을 열 때 지연 조회로 바꾸면 상세가 가벼워진다
- 이미지 삭제 확인창은 대화·갤러리·뷰어가 각자 띄운다(`onDelete` prop 전달). 앱 틀에 하나만 두고 작은 스토어로 열면 전달과 memo 비교가 준다
- 워커의 `cancel_requested` 를 잡 상태로 올리면 '중지하는 중…' 을 카드 로컬 상태·15초 타이머 대신 데이터로 그릴 수 있다
- 30일 만료 정리는 삭제·업로드 요청 뒤에만 돈다. 그런 요청이 없으면 만료 항목이 목록에 남는다(`D-0`). 서버 시작 시·주기 실행(`instrumentation.ts`)으로 옮기거나 목록이 만료분을 숨기면 된다
- 소프트 삭제 가시성(`deletedAt: null`)은 쿼리마다 쓴다. `refs` 의 `inputFor` 는 휴지통 대화의 잡도 센다. Prisma `$extends` 나 공용 where 조각으로 한 번에 걸 수 있다
- 뒤로·앞으로 가기로 `?image=` 가 바뀌어도 뷰어는 따라가지만, `LocationSync` 는 Next 가 바꾼 주소만 알리므로 다른 코드가 `history.pushState` 를 직접 부르면 `replaceSearch` 를 거쳐야 한다

## 4. QA 검증

모든 항목을 실행 중인 앱(test.db)에서 재현했고 증거 열에 파일을 적었다. 재현되지 않아 뺀 항목은 없다. 재현하며 고친 수용 기준:

- S5 자리표시자는 이미 글자로 있다("삭제한 이미지예요", 2곳). B2 는 "새로 만들기"가 아니라 틀·사유·라벨 보강이다.
- S6 스켈레톤은 4영역에 이미 있다. B7 은 빈틈 4곳과 낭독이다.
- 워커 끊김은 배너·자동 재개가 있어 백로그에서 뺐다(B9 는 API·폴링 실패만 다룬다).
- 성능 수치는 로컬 production 빌드 기준이라 절대값보다 내역(render delay, load delay)이 근거다. mock 이미지가 2KB 라 전송량 항목은 실데이터 크기(`storage/`)로 환산했다.
