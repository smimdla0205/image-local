# imagen-local 디자인 명세

[audit.md](audit.md) 백로그 항목별 화면 명세다. 규칙은 [디자인 시스템](https://claude.ai/artifact/YFBRYfyRPFq8gcNC425Ee4) 의 `project/README.md` 를 따르고, 새 상태의 그림은 [화면 캔버스](https://claude.ai/artifact/QtCpFAMckq7dDmpvNKvY5t) 의 세 번째 줄(`Delete`, `Trash`, `States` 아트보드)에 있다.

공통 원칙

- 면은 무채색, `signal` 은 진행·선택·포커스·드래그 중인 핸들에만, `destructive` 는 삭제·실패에만 쓰고 항상 단어나 아이콘을 붙인다.
- 문구는 상태나 동작 하나를 말하는 한 줄. 해요체, 이모지·느낌표 없음. 진행형은 "…"로 끝낸다.
- 새 컴포넌트는 shadcn 생성물(`src/components/ui/`)을 조합한다. 아이콘은 Lucide 16px(컨트롤 안)·20px(자리표시자).
- B3·B4·B6·B11·B16·B18·B19 는 화면이 바뀌지 않는다(구현만).

## B1 대화 삭제 모달

| 항목 | 명세 |
|---|---|
| 컴포넌트 | `AlertDialog` (`ui/alert-dialog.tsx`), 폭 400px, `card` 면, `shadow-popover`, `radius-lg` |
| 제목 | "대화를 삭제할까요?" (`text-title`). B12 뒤 "휴지통으로 옮길까요?" |
| 본문 | 대화 제목 한 줄(`text-caption`, `muted-foreground`, truncate) 아래 사실 목록. 줄마다 16px 아이콘 + `text-body`: `Images` "이미지 N장도 함께 삭제돼요" / `CircleAlert` "진행 중 K건을 중단해요"(K>0) / `Link2` "다른 대화 M건이 이 대화의 이미지를 원본으로 써요"(M>0). B12 뒤 마지막 줄 `Undo2` "30일 안에 휴지통에서 복구할 수 있어요" |
| 버튼 | 오른쪽 정렬. "취소"(outline) · "삭제"(`destructive` 바탕 + `Trash2`). 진행 중 "삭제하는 중…" + disabled, Esc·바깥 클릭 닫힘 방지 |
| 결과 | 토스트 "대화를 삭제했어요". B12 뒤 "휴지통으로 옮겼어요" + 동작 "되돌리기". 사이드바에서 즉시 제거, `/` 로 이동 |
| 토큰 | 아이콘 `muted-foreground`, 숫자 `tabular-nums` |

## B2 삭제한 이미지 자리표시자

| 항목 | 명세 |
|---|---|
| 컴포넌트 | 새 `components/chat/deleted-image.tsx`. 결과 격자용(`size="tile"`)과 말풍선용(`size="ref"`) 두 크기 |
| 결과 격자 | 잡의 width·height 비율 틀, `muted` 바탕, `radius-lg`, 안쪽 6px 에 `border` 점선(`outline: 1px dashed`), 가운데 `ImageOff` 20px + `text-micro` "삭제한 이미지예요". B12 뒤 그 아래 "복구" 링크(`text-label`, 밑줄) |
| 말풍선 | 80px 정사각 `ref` 틀, 같은 처리. `title`·`aria-label` "삭제한 이미지예요" |
| 사유 | 입력 이미지가 지워진 고치기는 결과 아래 "다시 생성" 대신 `text-caption` `muted-foreground` "원본을 삭제해서 다시 고칠 수 없어요" |
| aria | 결과 section 라벨은 남은 장수("만든 이미지 1장"). 자리표시자는 `role="img"` + 라벨 |

## B5·B10 사이드바 접기 유지와 너비 조절

| 항목 | 명세 |
|---|---|
| 핸들 | 사이드바 오른쪽 가장자리 8px 히트 영역(`cursor: col-resize`), 보이는 선은 1px `border`. hover·포커스·드래그 중 2px `signal`. `role="separator"` `aria-orientation="vertical"` `aria-label="사이드바 너비"` `aria-valuemin=192` `aria-valuemax=384` `aria-valuenow`, `tabIndex=0`, 포커스 링 `shadow-focus-ring` |
| 동작 | 드래그로 12~24rem, 방향키 16px, 더블클릭 16rem. 드래그 중 transition 끄고 본문 글자 선택 막음. 모바일(Sheet)에는 없음 |
| 유지 | 쿠키 `sidebar_width`(rem 숫자), `sidebar_state`. 첫 페인트 전 인라인 스크립트가 `<html>` 에 `data-sidebar="collapsed"`·`--sidebar-width-user` 를 올려 깜빡임 없이 복원 |
| 접힘 | 접힌 사이드바는 `inert`. 접으면 포커스가 Topbar 의 "사이드바 열기"로 간다. 열기 버튼은 error·not-found 에서도 보이게 AppShell 로 올린다 |

## B7 스켈레톤

| 자리 | 명세 |
|---|---|
| 뷰어 딥링크 | 무대: 1:1 `muted` 틀(이미지 비율을 모르면 정사각). 패널: 프롬프트 3줄(폭 100·92·60%), kv 4행(라벨 48px + 값 120px), 버튼 2개 높이 36px. 컨테이너 `aria-busy` + sr-only "불러오는 중…" |
| 업로드 칩 | 칩 자리에 48px 정사각 스켈레톤 + `text-label` "올리는 중…"(`muted-foreground`) + × 없음. `role="status"` |
| `?edit=` 대상 | 같은 칩 스켈레톤. 404 면 칩 자리에 `CircleAlert` + "고칠 이미지를 찾을 수 없어요" + ×(닫기) |
| 더 보기 | 버튼이 "불러오는 중…" disabled 로 바뀌고 격자 끝에 타일 스켈레톤 8칸 |
| 공통 | `Skeleton` 조각은 `aria-hidden`, 컨테이너 하나만 `aria-busy="true"` + sr-only "불러오는 중…". `motion-safe` 펄스 유지 |

## B8 타일에서 이미지 삭제

| 항목 | 명세 |
|---|---|
| 진입 | 결과 카드·갤러리 타일 hover 동작 줄 맨 끝에 `overlay` 아이콘 버튼 "삭제"(`Trash2`). 순서: 크게 보기 · 이어서 고치기 · 다운로드 · 삭제 |
| 모달 | 새 공용 `components/image-delete-dialog.tsx`. 제목 "이미지를 삭제할까요?". 본문: 48px 썸네일 + "버전 N · 모델" 캡션, 사실 목록 `GitBranch` "고친 버전 N개의 원본 연결이 끊겨요"(N>0) / `CircleAlert` "이 이미지로 만든 요청 K건은 다시 생성할 수 없어요"(K>0) / B12 뒤 `Undo2` "30일 안에 휴지통에서 복구할 수 있어요" |
| 버튼·상태 | B1 과 같다. 실패하면 모달을 유지하고 오류 토스트 |
| 결과 | 토스트 "이미지를 삭제했어요"(B12 뒤 "휴지통으로 옮겼어요" + "되돌리기"). 고칠 이미지 칩이 그 이미지면 칩 제거 |

## B9 오류·재시도

| 자리 | 명세 |
|---|---|
| 목록 오류 | 새 `components/ui/load-error.tsx`: `CircleAlert` 16px(`destructive`) + `text-label` 문구 + "다시 불러오기"(outline sm). 사이드바는 왼쪽 정렬 `px-2`, 갤러리·뷰어는 가운데 `py-16` |
| 폴링 끊김 | 워커 배너 자리의 `muted` 띠, `role="status"`: `RefreshCw` 16px + "연결이 끊겼어요. 다시 시도하는 중…" |
| 삭제된 대화(404) | 스레드 자리 Empty: 제목 "삭제된 대화예요", 설명 "휴지통에서 복구하거나 새 대화를 시작하세요", 버튼 "휴지통"(outline) · "새 대화"(primary). 폴링 중지 |
| error.tsx | Empty + "다시 시도"(`retry`) · "새 대화로" 링크. `<main>` 중첩 제거, 제목은 `h1` |

## B12 휴지통

| 항목 | 명세 |
|---|---|
| 진입 | 사이드바 바로가기 세 번째 "휴지통"(`Trash2`). 활성이면 `sidebar-accent` |
| 페이지 `/trash` | Topbar 제목 "휴지통", 오른쪽 "비우기"(outline, `destructive` 글자 + `Trash2`). 제목 아래 `text-caption` "30일이 지나면 자동으로 지워져요" |
| 목록 | 날짜 묶음(오늘·어제·지난 7일·이전). 행: 48px 썸네일(대화는 대표 이미지, 없으면 자리표시자) + 제목(`text-label`) + 메타(`text-caption`: "대화 · 이미지 3장" / "이미지 · Klein · 버전 2") + 남은 일수 `num` "D-29" + 동작 "복구"(outline sm) · "영구 삭제"(ghost sm, `destructive` 글자). hover `secondary` |
| 빈 상태 | Empty: "휴지통이 비어 있어요" + "삭제한 대화와 이미지가 30일 동안 여기에 있어요" |
| 비우기 | AlertDialog "휴지통을 비울까요?" + "대화 N개와 이미지 M장이 영구히 지워져요" / 버튼 "비우기"(destructive) |
| 토스트 | 삭제 직후 "휴지통으로 옮겼어요" + 동작 "되돌리기"(sonner `action`, 5초). 복구 뒤 "복구했어요" |

## B13·B15 문구와 동작 통일

| 자리 | 최종 문구 |
|---|---|
| 삭제 동사 | 삭제·삭제했어요·삭제하지 못했어요·삭제한 이미지예요·삭제된 대화예요 |
| 합쇼체 4줄 | "문제가 생겼어요" / "페이지를 찾을 수 없어요" / "주소가 잘못됐거나 삭제된 대화일 수 있어요" |
| 진행형 | "대기 중…", "생성 중…", "고치는 중…", "마무리하는 중…", "불러오는 중…", "올리는 중…", "삭제하는 중…", "중지하는 중…" |
| 잡 결과 | 취소한 잡 "취소했어요", 중지한 잡 "중지했어요" |
| 복사 실패 | "복사하지 못했어요" 하나 |
| 영어 잔재 | Sheet 제목 "메뉴", 설명 "대화 목록과 바로가기", Sonner 영역 "알림", SidebarTrigger sr-only 제거(aria-label 로 충분) |
| 뷰어 제목 | "크게 보기" |
| 배지 | 갤러리 배지를 대화와 같이 "텍스트→이미지"·"이어서 고치기"(좁으면 "생성"·"고침" 유지하되 `title` 로 긴 이름) — 구현은 긴 이름으로 통일 |
| 결과 행 버튼 | 모두 ghost + 16px 아이콘: 다시 생성(`RotateCw`), 프롬프트 복사(`Copy`), 다른 모델로 고치기(`Wand2`) |
| 갤러리 MOSS 타일 | "다른 모델로 고치기"(`Wand2`) 링크를 "이어서 고치기" 자리에 |
| 취소·중지 | 누르면 즉시 "취소하는 중…"·"중지하는 중…" disabled(15초 뒤에도 안 끝나면 되돌림) |

## B14 빈 상태

| 자리 | 명세 |
|---|---|
| 사이드바 | `text-caption` "아직 대화가 없어요" 아래 "새 대화" 링크(`text-label`, 밑줄) |
| 갤러리 | `Empty`(`ui/empty.tsx`): `Images` 24px `muted-foreground`, 제목 "찾는 이미지가 없어요"(필터·검색 중) / "아직 만든 이미지가 없어요", 설명 한 줄, 버튼 "필터 지우기"(outline) / "새 대화"(primary) |
| 오류·빈 공통 | 사이드바·갤러리·뷰어가 같은 `Empty`·`LoadError` 를 쓴다 |

## B17 접근성

| 항목 | 명세 |
|---|---|
| skip link | 첫 Tab 에 왼쪽 위 "본문으로 건너뛰기"(outline, `fixed top-2 left-2`, 포커스 전에는 sr-only) → `#main` |
| 포커스 링 | 전부 `shadow-focus-ring`(바탕 2px 틈 + `signal` 2px). 프롬프트 입력창은 `focus-within` 에 같은 링 |
| 가림 | `html { scroll-padding-top: 4rem; scroll-padding-bottom: 8rem }` |
| alt | 결과·갤러리·뷰어: 프롬프트 앞 80자 + " (n/N)" |
| 라벨 | Sonner `containerAriaLabel="알림"`, Sheet 제목 한국어, 사이드바 접힘 `inert` |
| 모션 | 사이드바 접기·Dialog·Sheet `motion-reduce:transition-none` |
