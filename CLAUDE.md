@AGENTS.md

# imagen-local

Hugging Face 오픈 웨이트 이미지 모델을 빌린 GPU 에 올려 채팅으로 쓰는 Next.js 앱이다. 구조, 명령, 버전 고정 이유는 [README.md](README.md) 를 본다. 테스트는 작업공간 루트 `tests/` 에서 관리하고 이 폴더에는 만들지 않는다.

## 모델

아래 네 개만 쓴다. 지금 구현 대상은 앞의 세 개이고 Fibo 2.0 Edit Turbo 는 보류다. 다른 모델은 사용자가 요청할 때만 추가한다.

| 모델 | Hugging Face | 텍스트→이미지 | 텍스트+이미지→이미지 | step | 라이선스 |
|---|---|---|---|---|---|
| FLUX 3 Image Klein | [black-forest-labs/flux-3-image-klein](https://huggingface.co/black-forest-labs/flux-3-image-klein) | O | O. 레퍼런스 최대 10장 | 16 | FLUX Kommunity License. 연 매출 500만 USD 미만이면 상업 생성물 무료. gated |
| Qwen-Image-2.1-Turbo | [Qwen/Qwen-Image-2.1-Turbo](https://huggingface.co/Qwen/Qwen-Image-2.1-Turbo) | O | O. 레퍼런스 최대 10장(2.1 원본 카드 기준) | 8. 증류판 | Qwen Research License, 비상업 |
| MOSS-Image 4-step | 베이스 [OpenMOSS-Team/MOSS-Image-SFT](https://huggingface.co/OpenMOSS-Team/MOSS-Image-SFT) + LoRA [akhaliq/MOSS-Image-SFT-4-steps](https://huggingface.co/akhaliq/MOSS-Image-SFT-4-steps) | O | X | 4. 1024² 초과는 6~8 | Apache-2.0 |
| Fibo 2.0 Edit Turbo (보류) | [briaai/Fibo-2.0-edit-turbo](https://huggingface.co/briaai/Fibo-2.0-edit-turbo) | X. 카드가 편집 전용이라고 명시한다 | O. 레퍼런스 최대 4장 | 4 | CC BY-NC 4.0, 비상업. gated |

gated 모델은 GPU 워커가 쓰는 Hugging Face 토큰의 계정으로 모델 페이지 약관에 먼저 동의해야 받을 수 있다.

**Fibo 2.0 Edit Turbo 는 보류다.** 접근 신청에 도메인 정보가 필요해 보여 신청하지 않았고, 지금 토큰으로는 다운로드가 거부된다(403). 사용자가 다시 열자고 할 때까지 GPU 워커와 UI 에 넣지 않는다. 아래 입력 방식은 그때를 위한 참고다.

## 디자인 시스템

UI 는 [imagen-local 디자인 시스템](https://claude.ai/artifact/YFBRYfyRPFq8gcNC425Ee4) 을 따른다. 규칙 전문은 그 아티팩트의 `project/README.md` 다. 토큰은 [globals.css](src/app/globals.css) 의 shadcn 변수에 연결돼 있고, 글꼴은 [layout.tsx](src/app/layout.tsx) 에서 불러온다.

- 면은 무채색이다. 색은 `signal` 하나를 생성 진행, 선택, 키보드 포커스에만 쓴다.
- 글자는 `text-display`, `text-title`, `text-body`, `text-label`, `text-caption`, `text-micro` 스타일을 쓴다. 12px 보다 작은 글자는 쓰지 않는다.
- 표식은 스텝 미터다. 모델이 한 장을 만드는 step 수만큼 칸을 그린다: Klein 16칸, Qwen Turbo 8칸, MOSS 4칸.
- 문구는 해요체로 짧게 쓰고, 이모지와 느낌표를 쓰지 않는다.

## 입력 방식

- **FLUX 3 Klein:** 프롬프트는 prompt upsampler [black-forest-labs/flux-3-image-klein-pup](https://huggingface.co/black-forest-labs/flux-3-image-klein-pup) 로 장면 캡션을 만들어 넣는다(모델 카드 요구). upsampler 시스템 프롬프트는 `t2i`, `i2i`, `t2i_bbox`, `i2i_bbox` 이고, `i2i` 는 레퍼런스 이미지를 user 메시지 앞에 넣으며, `*_bbox` 는 캡션 뒤에 박스 목록까지 만든다. 레퍼런스는 `image` 에 한 장 또는 리스트로 넘긴다. 배치는 캡션 뒤에 `id`·`bbox`·`desc` 요소의 JSON 목록을 붙이고 캡션에서 `<id>` 로 가리킨다. `bbox` 는 0~1000 격자의 `[top, left, bottom, right]` 이고 위치 안내일 뿐 마스크가 아니다. 박스 편집에서 n 번째 레퍼런스는 `<ref_image_n>` 이다.
- **Qwen-Image-2.1-Turbo:** 자연어 프롬프트. 편집할 이미지는 RGBA 로 바꿔 `image` 에 넘긴다. 2.1 원본 카드 기준으로 투명 배경은 프롬프트를 "This is an RGBA image with transparency." 로 시작하고, 국소 편집은 동그라미·페인트 표시나 별도 마스크로 지정한다. 여러 장 레퍼런스와 마스크를 넘기는 파라미터는 두 카드 모두 적지 않았다.
- **MOSS-Image:** 자연어, 태그 시퀀스, JSON 레이아웃(실험적) 세 가지를 받는다. 문법은 [USERGUIDE](https://github.com/OpenMOSS/MOSS-Image/blob/main/USERGUIDE.md) 에 있다.
  - 태그: 쉼표로 나열하고 Quality → Score → Meta → Year → Character → Series → Artist → General 순서로 쓴다. 가이드 예시: `best quality, highres, hatsune miku, vocaloid, @foo bar, 1girl, blue hair`
  - JSON 레이아웃: `summary` 에 장면 설명(`caption`)을, `items` 의 각 항목에 `label`·`caption`·`bbox`·(선택) `text` 를 쓰고 `"bbox_format": "yxyx"`(`[y_min, x_min, y_max, x_max]`), `"bbox_coord_space": "abs_centralized"` 를 둔다. 좌표는 캔버스 중심 기준 픽셀이라 1024² 면 -512~512 다. `json.dumps(layout, ensure_ascii=False)` 를 프롬프트로 넘기고 width·height 를 레이아웃과 맞춘다.
  - 이미지에 넣을 글자는 따옴표로 감싸고, 줄바꿈은 `\n` 으로 넣는다.
  - 4-step LoRA 는 negative prompt 없이 CFG 1 로 돈다. LoRA 카드는 태그 입력을 다루지 않고, 1024² 를 넘기면 짧은 프롬프트가 흐려지니 긴 문장으로 쓰라고 한다.
- **Fibo 2.0 Edit Turbo:** 입력 이미지가 있어야 한다. `prompt` 에는 평문 편집 지시나 VGL JSON 캡션을 넣는다. VGL 은 `bria-vgl` 의 `modify()` 가 이미지와 지시로 만들고 `edit_instruction` 필드를 담는다. `bria-vgl` 은 Gemini 로 돌아 `GEMINI_API_KEY` 가 필요하다. 레퍼런스는 `image` 에 리스트로 넘기고 프롬프트에서 `<image_1>`, `<image_2>` 로 가리킨다. 마스크는 원본과 같은 크기의 흑백(`L`) 이미지를 `mask` 에 넘기고 흰색이 다시 그릴 영역이다. negative prompt 는 효과가 없다.

## 구현할 때 볼 것

- Qwen-Image-2.1-Turbo 는 step 스케줄이 체크포인트에 들어 있어 `num_inference_steps` 로 바뀌지 않는다.
- 완료 통지는 폴링이다. `GET /api/conversations/[id]`·`GET /api/jobs/[id]` 가 응답 전에 진행 중인 잡을 워커와 맞추고(`src/lib/jobs/sync.ts`), 워커가 꺼져 있으면 잡을 그대로 두고 `worker.reachable=false` 를 돌려준다. webhook 은 없다.
- GPU 워커는 Modal 앱(`gpu/modal_app.py`)이다. 실행·배포 명령은 README 의 'GPU 워커' 절에 있다.
- ComfyUI 워크플로는 `gpu/workflows/` 의 API 포맷 JSON 이고, 잡 값을 넣을 노드 입력은 `bindings.json` 이 정한다. 손으로 고치지 않고 작업공간 루트의 `tests/imagen-local/tools/export-workflows.mjs` 로 공식 템플릿에서 다시 내보낸다. 프롬프트 보강(TextGenerate)은 Klein 만들기에만 켜 있다. Klein 고치기는 한 번에 90초가 걸려 껐고, Qwen 은 보강 모델 파일이 없고, MOSS 는 사용자가 쓴 글자·태그를 그대로 쓰려고 껐다.
- Qwen-Image-2.1 VAE 는 투명 배경을 고르지 않아도 RGBA 를 낸다. 러너가 투명 배경이 아닌 잡의 결과를 RGB 로 바꾼다.
- ComfyUI 는 같은 그래프(프롬프트·시드·크기)의 결과를 캐시한다. 같은 시드로 다시 만들면 샘플링 없이 같은 이미지가 바로 나온다.
- Qwen-Image-2.1 순정 VAE 는 체커보드 무늬와 fp16 NaN 문제가 있다. 대체 VAE 는 [파생판 문서 §2.3](docs/local-image-model-derivatives.md#23-평가-좋은-것) 에 있다.

## 레퍼런스

| 찾는 것 | 위치 |
|---|---|
| 모델별 사양, 리포 구성, 라이선스 근거 | 리서치 문서 FLUX [§3](docs/local-image-models-research.md#3-flux-계열-상세), Qwen [§4](docs/local-image-models-research.md#4-qwen-image-계열-상세), MOSS [§5](docs/local-image-models-research.md#5-moss-image-계열-상세), Fibo [§6](docs/local-image-models-research.md#6-fibo-계열-상세) |
| `hf download` 명령 | [리서치 문서 §8](docs/local-image-models-research.md#8-다운로드-명령) |
| LoRA, VAE 교체 같은 파생판과 조합 레시피 | [파생판 문서 §7](docs/local-image-model-derivatives.md#7-조합-레시피) |
| GPU 종류·개수 | `.env` 의 `GPU_TYPE`, `GPU_COUNT`. 기본값 H100 1대는 [src/lib/gpu/config.ts](src/lib/gpu/config.ts) |
| GPU 서버 주소·토큰 | `GPU_API_URL`, `GPU_API_TOKEN`. Modal 워커 값은 `gpu/configure.py` 가 `.env.local` 에 쓴다. mock 워커는 `http://localhost:8787`, `dev-token` |
| Modal 계정 | `.env` 의 `MODAL_PROFILE`, `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`. Modal 은 `.env` 를 직접 읽지 않아서 modal 명령 전에 `set -a; source .env; set +a` 로 셸에 불러온다. 이 PC 에서는 `modal` 이 PATH 에 없으면 `python -m modal` 로 부른다 |
