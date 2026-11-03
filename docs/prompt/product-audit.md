# imagen-local 제품 감사·구현 프롬프트

사용: 작업공간 루트(`C:\Users\sangm\Desktop\AI`)의 Claude Code 에서 `@project/imagen-local/docs/prompt/product-audit.md 대로 진행해` 라고 보낸다.

## 역할

너는 `project/imagen-local` 의 PM 겸 UX 감사자다. 사용자가 적어 주지 않은 요구사항을 직접 찾아 백로그로 만들고, 검증된 항목을 디자인 → 플랜 → 구현 → 리뷰까지 끝낸다.

## 진행 원칙

- 1 단계부터 9 단계까지 자동으로 진행한다. 보고는 9 단계에서 한 번만 한다. 막히면 가정을 정해 계속하고, 가정은 보고에 적는다.
- 스킬이 사용자에게 묻는 지점(`writing-plans` 의 실행 방식 질문, `test-driven-development` 의 예외 확인, `frontend-design` 의 주제 확인)은 `audit.md`·`design.md` 의 내용으로 스스로 정하고 계속한다. 1~5 단계가 `brainstorming` 을 대신한다.
- 저장소 안 파일의 생성·수정·삭제, 커밋, push(`origin feat/imagen-v3`), 배포, 마이그레이션, DB reset, 화면 캔버스 artifact 재발행은 확인 없이 한다. 이 프롬프트가 그 승인이다.
- DB reset 이나 데이터가 지워지는 마이그레이션 전에는 `dev.db` 와 `storage/` 를 백업하고 경로를 보고에 적는다.
- 커밋은 `dev` 에서 만든 브랜치 `feat/imagen-v3` 에 쌓는다. 머지는 보고 뒤 사용자가 한다.
- 감사 중 삭제·덮어쓰기는 감사용으로 새로 만든 대화·이미지에서만 눌러 본다. 사용자의 기존 대화는 읽기만 한다.
- GPU 워커는 mock 워커로 띄운다(`project/imagen-local/README.md` 의 'GPU 워커' 절).

## 산출물

| 파일 | 내용 | 만드는 단계 |
|---|---|---|
| `project/imagen-local/docs/plan/audit.md` | 화면·동작 표, 렌즈별 발견, 백로그, QA 증거 | 1~4 |
| `project/imagen-local/docs/plan/design.md` | 항목별 디자인 명세 | 5 |
| `project/imagen-local/docs/plan/plan.md` | 구현 플랜 | 6 |
| 화면 캔버스 artifact | 새 상태·화면 추가 | 5 |

문서는 현재 상태만 적는다. 날짜·변경 이력 문구는 넣지 않는다.

## 씨앗 항목

사용자가 이미 요구한 것이다. 감사 결과와 상관없이 백로그에 넣고 4 단계부터 같이 거친다.

1. 왼쪽 사이드바 너비 조절(드래그), 너비 유지
2. 대화 삭제 전 확인 모달. 모달이 "이 대화의 이미지 N 장도 함께 삭제돼요" 를 말한다
3. 삭제된 대화·이미지는 휴지통으로 가고 복구할 수 있다
4. 이미지 개별 삭제(대화 안, 갤러리)
5. 대화에서 삭제된 이미지 자리에 "삭제된 이미지입니다" 자리표시자
6. 비동기 영역 전체에 스켈레톤
7. 페이지 로딩·상호작용 성능 개선(수치로)

## 1. 현황 파악

- `project/imagen-local/README.md`, `docs/`, `AGENTS.md` 로 기능 범위를 읽는다.
- 앱을 띄우고(`run` 스킬) `playwright-cli` 로 모든 라우트와 버튼·메뉴·모달을 눌러 본다. 화면별 "할 수 있는 동작" 표를 `audit.md` 에 쓴다.
- 완료 기준: 라우트와 사용자 동작이 빠짐없이 표에 있다.

## 2. 렌즈별 점검

화면·동작마다 렌즈를 하나씩 대고 발견을 `audit.md` 에 적는다. 렌즈마다 "해당 없음" 도 명시한다.

| 렌즈 | 질문 | 도구 |
|---|---|---|
| 상태 가시성 | 비동기 데이터마다 로딩(스켈레톤)·빈 상태·오류·삭제됨 상태가 있는가 | `web-design-guidelines` |
| 파괴적 동작 | 삭제·덮어쓰기 전에 확인 모달이 있고, 함께 사라지는 것을 모달이 말해 주는가. 휴지통·undo 로 복구할 수 있는가 | `web-design-guidelines` |
| 데이터 수명주기 | 부모(대화)를 지우면 자식(이미지·파일)은 어떻게 되는가. 지워진 것을 참조하는 화면은 자리표시자를 보이는가 | `prisma/schema.prisma` 의 relation·`onDelete`, 삭제 API route, `storage/` 파일 처리 |
| 개별 제어 | 묶음으로만 되는 동작을 개별로도 할 수 있는가 | 1 단계 표 |
| 레이아웃 유연성 | 패널 크기 조절·접기, 그 설정의 유지, 좁은 화면 | `playwright-cli` 로 너비를 바꿔 본다 |
| 성능 | LCP·INP, 번들 크기, 이미지 lazy/sizes, 긴 목록 가상화, API N+1·캐시 | 측정은 `web-perf` + `chrome-devtools-mcp`, 코드는 `vercel-react-best-practices`, 번들은 `next-bundle-optimizer` |
| 접근성·키보드 | 포커스 이동, 라벨, 대비, Esc 로 모달 닫기 | `chrome-devtools-mcp:a11y-debugging` |
| 오류 복구 | 생성 실패·워커 끊김·네트워크 오류 뒤 재시도 경로 | mock 워커를 끄고(`worker.reachable=false`) 본다 |
| 일관성 | 같은 동작은 같은 자리·같은 문구인가 | 1 단계 표 |

완료 기준: 모든 화면 × 모든 렌즈 칸이 발견 또는 "해당 없음" 으로 차 있다. 성능 렌즈는 수치가 있다.

## 3. 백로그

항목마다: 현상 → 기대 동작 → 렌즈 → 영향(상/중/하) → 난이도(상/중/하) → 손댈 파일 → 수용 기준(검증 가능한 문장 1~3개).
영향 높고 난이도 낮은 순으로 정렬해 `audit.md` 에 쓴다.
완료 기준: 모든 항목에 수용 기준이 있다.

## 4. QA 검증

- 항목마다 실행 중인 앱에서 현상을 재현하고 증거(스크린샷·trace, `tests/reports/playwright-cli/`)의 경로를 `audit.md` 에 적는다.
- 재현되지 않는 항목은 백로그에서 뺀다. 재현하며 알게 된 것으로 수용 기준을 고친다.
- 완료 기준: 남은 모든 항목에 증거 경로가 있다.

## 5. 디자인

- `frontend-design:frontend-design` 스킬을 쓴다. 디자인 시스템과 화면 캔버스는 메모리 `reference-imagen-local-design` 의 artifact 두 개다. 규칙 전문은 디자인 시스템 artifact 의 `project/README.md`.
- 항목마다 `design.md` 에 적는다: 화면, 쓰는 컴포넌트(shadcn), 상태(기본·로딩·빈·오류·삭제됨), 문구, 토큰. `signal` 은 생성 진행·선택·포커스에만 쓴다.
- 문구는 상태나 동작 하나를 말하는 한 줄로 끝낸다. 해요체, 이모지·느낌표 없음.
- 화면 캔버스 artifact 를 읽고 새 상태·화면을 더해 같은 URL 로 다시 발행한다.
- 완료 기준: 모든 항목이 `design.md` 와 캔버스 양쪽에 있다.

## 6. 플랜

- `superpowers:writing-plans` 로 `plan.md` 를 쓴다. 저장 경로는 스킬 기본값 대신 `project/imagen-local/docs/plan/plan.md`.
- 항목을 논리적 묶음(phase)으로 나눈다. 예: 삭제·휴지통, 로딩 상태, 레이아웃, 성능.
- 완료 기준: 모든 백로그 항목이 어느 phase 의 어느 task 인지 정해져 있다.

## 7. 구현

- `superpowers:executing-plans` 로 `plan.md` 를 실행한다.
- 항목 하나 = 커밋 하나. 수용 기준 하나 = 테스트 하나(테스트 이름이 수용 기준 문장). 테스트는 `tests/README.md` 대로 `tests/imagen-local/` 에 `superpowers:test-driven-development` 순서로 먼저 쓴다.
- 항목마다 `superpowers:verification-before-completion` 으로 수용 기준을 실제 실행(테스트·typecheck·화면 확인)으로 확인한 뒤 커밋한다.
- phase 가 끝날 때마다 `/code-review`, `/security-review`, `/codex:review --wait` 를 돌린다. 지적은 `superpowers:receiving-code-review` 로 검증한 뒤 고치고, 테스트를 다시 돌려 "리뷰 반영" 커밋을 만든 다음 phase 로 간다.
- 완료 기준: 모든 항목이 수용 기준 통과이거나 막힌 이유가 적혀 있다.

## 8. 마무리

- `/simplify` 로 정리한다.
- `tests/README.md` 의 실행 명령으로 전체 테스트·typecheck·lint 를, `project/imagen-local` 에서 build 를 돌린다. production build 로 핵심 흐름(새 대화 → 생성 → 삭제 → 복구)을 브라우저로 한 번 돈다.
- 구현하며 바뀐 문구·상태를 화면 캔버스에 맞춘다.
- 완료 기준: 전부 통과. 실패는 그대로 보고로 간다.

## 9. 보고

한 번만, 채팅으로:

- 완료·미완료·보류 항목과 각 증거(실행한 명령·결과)
- 리뷰에서 나온 지적과 고친 내용 요약
- 진행 중 정한 가정
- 머지할 브랜치와 커밋 수
- 범위 밖 발견은 `audit.md` 의 후속 백로그에 남긴다
