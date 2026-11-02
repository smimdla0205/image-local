# 확정 모델 4종과 LoRA 정리

> **범위:** H100 1대에 올려 이미지 서비스를 만들기로 확정한 4개 구성 — FLUX 3 Image Klein / Qwen-Image-2.1-Turbo / MOSS-Image-SFT + 4-step LoRA / Fibo 2.0 Edit Turbo — 의 **기본 모델**과 모델별 **LoRA**. 근본 모델의 상세는 [`local-image-models-research.md`](./local-image-models-research.md), 파생판 전체 조사는 [`local-image-model-derivatives.md`](./local-image-model-derivatives.md) 에 있고, 여기서는 확정 구성에 필요한 것만 1차 출처로 대조해 적는다.
> **인기도·날짜:** HF 수치는 모델 API 응답의 `downloads`(최근 30일), `likes`(누적), `downloadsAllTime`(괄호의 "누적", 30일 수치와 같으면 생략), `createdAt`(UTC 날짜), `gated`(`auto` 는 약관에 동의해야 파일을 받는 리포, 표의 '없음'은 `false`)이다 [L1]. 허브는 `config.json`·`model_index.json`·최상위 `*.safetensors` 같은 질의 파일 요청을 다운로드로 세므로 라이브러리 태그가 없는 LoRA 단일 파일 리포는 `0` 으로 보일 수 있고, `0` 이 곧 사용 없음은 아니다 [L2]. Civitai `downloadCount`·`thumbsUpCount` 는 누적이고 모델 값은 모든 베이스 버전의 합산이라서, 해당 베이스 버전만의 값을 괄호에 적는다 — "모델 dl / ♥ (버전 dl / ♥)" 순서다 [L3][L4]. "공개" 는 개발사가 밝힌 일자, "HF 등록" 은 리포 `createdAt`, LoRA 의 공개(등록)일은 HF 는 `createdAt`, Civitai 는 해당 베이스 버전의 `publishedAt` 이다.
> **라이선스·제외:** 라이선스 칸은 카드·API 표기를 옮긴 것이고 법적 판단이 아니다. Civitai 는 API 의 `allowCommercialUse` 배열과 `allowDerivatives` 값을 그대로 적는다(값의 의미는 API 문서에 정의가 없다) [L3]. 성인물 LoRA 는 추천 표에 넣지 않고 모델별 "제외한 것"에 이름만 적는다.

---

## 목차

1. [핵심 요약](#1-핵심-요약)
2. [기본 모델 정리](#2-기본-모델-정리)
3. [LoRA 정리](#3-lora-정리)
4. [확인 불가 항목](#4-확인-불가-항목)
5. [출처 목록](#5-출처-목록)

---

## 1. 핵심 요약

| 계열 | 쓸 모델 (리포 ID) | 공개일 | 인기도 (HF dl 30일 / likes) | 역할·특장점 한 줄 | 라이선스 |
| --- | --- | --- | --- | --- | --- |
| **FLUX 3 Image Klein** | `black-forest-labs/flux-3-image-klein` (ComfyUI `-comfy`, prompt upsampler `-pup`) | 2026-10-15 (HF 등록 10-13) | `-comfy` 970,633 / ♥2,291 · 증류판 152,681 / ♥795 | T2I + 편집 + 레퍼런스 10장 + 바운딩박스, 증류판 16 step, 오픈웨이트 AA T2I 1위(1043). 글자 렌더링이 약하고 upsampler 가 필수다. [L12][L13][L8] | FLUX Kommunity v1.0, gated |
| **Qwen-Image-2.1-Turbo** | `Qwen/Qwen-Image-2.1-Turbo` (ComfyUI `Comfy-Org/Qwen-Image-2.1`) | 2026-10-09 (원본 2.1 은 09-20) | Turbo 40,738 / ♥1,092 · `Comfy-Org/Qwen-Image-2.1` 10,554,957 / ♥1,241 | 편집이 강점(레퍼런스 10장·마스크 국소 편집·RGBA 투명), 8 step CFG 1. AA 점수 1042/1081 은 원본 2.1 의 것이다. [L16][L17][L8][L9] | Qwen Research License (비상업 연구·평가 한정) |
| **MOSS-Image** | `OpenMOSS-Team/MOSS-Image-SFT` + LoRA `akhaliq/MOSS-Image-SFT-4-steps` (ComfyUI `Comfy-Org/MOSS-Image`) | 2026-10-16 | SFT 16,757 / ♥871 · `Comfy-Org/MOSS-Image` 4,215,132 / ♥571 · 4-step LoRA 49,021 / ♥80 | T2I 전용, 긴 글자·JSON 레이아웃(LLTB 96.3, 개발팀 자체 벤치), 4 step. 편집 불가. [L21][L23][L26] | **Apache-2.0** |
| **Fibo 2.0** | `briaai/Fibo-2.0-edit-turbo` (ComfyUI `Comfy-Org/Fibo-2.0`) | 2026-10-19 (dev 10-18, HF 등록일) | Edit Turbo 1,905 / ♥153 · `Comfy-Org/Fibo-2.0` 264,445 / ♥224 | 편집 AA 오픈웨이트 1위(1088), 4 step, 마스크 편집·레퍼런스 4장. T2I 는 이미지 없이 호출하는 커뮤니티 확인 방식이다. [L28][L9][L31] | CC BY-NC 4.0, 원본 gated |

**H100 1대(80GB) 메모리:** 가중치 합계는 공유 없이 73.12GB, `qwen3vl_4b` int8·`flux2-vae` 를 공유하면 67.58GB 라서 여유가 약 7~12GB 이고, 생성 중 활성 메모리는 별도다 — 계산은 [2.5](#25-h100-1대-메모리-계산).

---

## 2. 기본 모델 정리

### 2.1 FLUX 3 Image Klein

**리포·파일** [L6][L12][L14]

| 역할 | 리포 ID | 쓸 파일 | 크기(GB) |
| --- | --- | --- | --- |
| 증류판 원본 (diffusers) | `black-forest-labs/flux-3-image-klein` | BF16 transformer 패키지 + FP8·NVFP4 변종, 인코더·오토인코더 포함 | — |
| ComfyUI 패키지 | `black-forest-labs/flux-3-image-klein-comfy` | `diffusion_models/flux3-image-klein-int8-convrot.safetensors` | 5.83 (bf16 11.10 / nvfp4 5.28) |
| | | `text_encoders/qwen3vl_4b_int8_convrot.safetensors` | 4.86 (bf16 8.88) |
| | | `vae/flux2-vae.safetensors` | 0.34 |
| prompt upsampler (9B) | `black-forest-labs/flux-3-image-klein-pup` | ComfyUI: `text_encoders/qwen3.5_9b_flux3_prompt_upsampler_int8_convrot.safetensors` | 9.75 (w4a8 6.72 / bf16 18.82) |
| 학습용 Base (50 step) | `black-forest-labs/flux-3-image-klein-base` | `diffusion_models/flux3-image-klein-base-int8-convrot.safetensors` | 5.81 (bf16 11.08) |

**공개일·인기도**

| 리포 | 공개 | HF 등록 | dl 30일 (누적) / likes | gated |
| --- | --- | --- | --- | --- |
| `flux-3-image-klein` (증류판) | 2026-10-15 | 2026-10-13 | 152,681 / ♥795 | auto |
| `flux-3-image-klein-comfy` | — | 2026-10-14 | 970,633 / ♥2,291 | auto |
| `flux-3-image-klein-base` | — | 2026-10-13 | 118,669 / ♥212 | auto |
| `flux-3-image-klein-pup` | — | 2026-10-14 | 61,979 / ♥73 | 없음 |

공개일은 BFL 블로그의 게시일이다. [L1][L13]

- **사양:** 이미지 트랜스포머 5.6B(텍스트 인코더는 별도) + Qwen3-VL-4B-Instruct 인코더. 프롬프트 하나와 레퍼런스 최대 10장을 받아 이미지 한 장을 낸다. [L12]
- **기능:** T2I, 단일·멀티 레퍼런스 편집, 0~1000 그리드 바운딩박스(배치·크기 지정이며 하드 마스크는 아님), 네이티브 4K. [L12][L13]
- **스텝:** 증류판은 16 step·guidance 없음, Base 는 50 step·guidance 3.5 이고 파인튜닝·LoRA 학습은 Base 로 하라고 카드가 안내한다. ComfyUI 증류판 템플릿은 steps 4~16(기본 16)이고 cfg 1 이라 올려도 소용없다. [L12][L15]
- **속도:** BFL 측정 INT8 증류판 1MP 약 4초(RTX 5090)·9초 미만(RTX 4070, ComfyUI). LoRA 를 서빙하면 생성 시간이 약 5% 늘어난다. H100 수치는 없다. [L13]
- **AA 점수:** 오픈웨이트 T2I 1043(±12, 1위), 편집 1072(±14, 3위). 이 항목은 BFL API(`flux-3-image-klein`, 1K, BFL upsampler 사용)로 만든 결과다. [L8][L9]
- **권장 설정:** ComfyUI 0.41.0 이상, 템플릿 `FLUX 3 Image Klein Distilled: Text to Image` / `… Image Edit`, CLIPLoader type `flux3`. 템플릿은 int8 DiT(`flux3-image-klein-int8-convrot`) + int8 인코더 + `flux2-vae` 를 로드하고, T2I 템플릿은 upsampler 를 기본으로 켜며(`enable_prompt_upsampler`) 파일은 w4a8(`qwen3.5_9b_flux3_prompt_upsampler_w4a8`, 6.72GB)이다. 24GB 가 넘으면 bf16 빌드로 바꾸라고 안내한다. 멀티레퍼런스 편집은 `Set Reference Multi Latent` 를 거쳐 프롬프트에서 `<ref_image_0>`, `<ref_image_1>` 로 지칭하고, 증류판 편집 템플릿은 레퍼런스 1장만 쓴다. [L15][L10]
- **특장점:** 5.6B 의 경량 모델이다(BFL 은 자사 비교군에서 가장 작다고 밝히며 비교군은 Qwen-Image 2.1 7B·Krea 2 12.9B, 네 모델 중에는 MOSS 5B 가 더 작다). 오픈웨이트 T2I 1위, 레퍼런스 10장, 바운딩박스 배치와 국소 편집, 증류판 16 step. [L12][L13][L8]
- **약점·주의:** (1) 글자가 부정확하거나 일그러질 수 있고 짧은 프롬프트는 평범한 결과가 나온다(카드의 한계 항목). (2) 카드가 upsampler 없이 쓰지 말라고 명시한다 — 풀 장면 캡션을 받는 모델이라 `-pup`(또는 `system_prompts.json` 을 쓴 다른 LLM)이 필수이고, 레퍼런스 코드는 80GB GPU 에서 upsampler 가 약 28GB 를 더 쓴다. (3) 박스는 하드 마스크가 아니라서 요소가 박스 밖으로 나가거나 작은 요소가 빠질 수 있고, 편집이 요청 영역 밖 내용을 바꿀 수 있다. [L12][L14]
- **라이선스:** FLUX Kommunity License v1.0 — 비상업 사용, 연 매출 500만 USD 미만(계열사 포함)의 상업 생성물, 그 외는 상업 라이선스·BFL API. 카드는 이 상업 예외가 상업적 파인튜닝·배포의 포괄 허가가 아니라고 못 박고, 모델·파생물·출력물로 유사 기능의 다른 AI 모델을 개선하는 것을 금지한다. 증류판·`-comfy`·`-base` 는 gated 이고 `-pup`(Apache-2.0)과 Qwen3-VL-4B-Instruct 인코더(Apache-2.0)는 아니다. HF `license` 태그는 `other`(카드 표기 `flux-kommunity-license`)이고 `-pup` 만 `apache-2.0` 이다. [L12][L14][L1]
- **같이 쓸 부품:** `-pup` upsampler(사실상 필수), 학습할 때만 `-base`. [L12][L14]

### 2.2 Qwen-Image-2.1-Turbo

**리포·파일** [L6][L16][L18][L20]

| 역할 | 리포 ID | 쓸 파일 | 크기(GB) |
| --- | --- | --- | --- |
| Turbo 원본 (diffusers) | `Qwen/Qwen-Image-2.1-Turbo` | `QwenImage21Pipeline` 로 로드 | — |
| ComfyUI 패키지 | `Comfy-Org/Qwen-Image-2.1` | `diffusion_models/qwen_image_2.1_turbo_int8_convrot.safetensors` | 7.26 (bf16 14.23) |
| | | `text_encoders/qwen3vl_8b_int8_convrot.safetensors` | 9.35 (bf16 17.53 / w4a8 6.31) |
| | | `vae/qwen_image_2.1_vae_bf16.safetensors` | 0.68 |
| 선택: 프롬프트 보강 | `Comfy-Org/Qwen-Image-2.1` | `text_encoders/qwen3.5_9b_qwen_image_2.1_pe_t2i.int8_convrot.safetensors` (편집용 `…_pe_i2i…`) | 9.47 (w4a8 6.72) |
| 선택: VAE 교체 | `madebyollin/texture-fix-vae-for-qwen-image-2.1` | `texture_fix_vae_for_qwen_image_2.1_bf16.safetensors` | 0.68 |

**공개일·인기도**

| 리포 | 공개 | HF 등록 | dl 30일 (누적) / likes | gated |
| --- | --- | --- | --- | --- |
| `Qwen/Qwen-Image-2.1-Turbo` | 2026-10-09 | 2026-10-09 | 40,738 / ♥1,092 | 없음 |
| `Qwen/Qwen-Image-2.1` (원본) | 2026-09-20 | 2026-09-14 | 217,429 (누적 302,817) / ♥3,522 | 없음 |
| `Comfy-Org/Qwen-Image-2.1` | — | 2026-09-15 | 10,554,957 (누적 16,519,640) / ♥1,241 | 없음 |
| `madebyollin/texture-fix-vae-for-qwen-image-2.1` | — | 2026-09-24 | 134,989 (누적 145,398) / ♥211 | 없음 |

공개일은 AA 의 `releaseDate` 이고 Turbo 의 HF 등록일과 같다. 원본은 HF 등록이 공개보다 6일 빠르다. [L1][L8]

- **사양:** 시각 생성부 7B(32층 single-stream DiT), Qwen3-VL 8B 인코더. Turbo 는 같은 아키텍처의 8 step 증류판이다. [L17][L16][L18]
- **기능:** T2I + 지시 편집 통합, 레퍼런스 최대 10장(ComfyUI 노드 슬롯은 16개, 편집 템플릿은 10개를 연결), 동그라미·페인트 주석·별도 마스크로 국소 편집, 인물·제품 아이덴티티 유지, 네이티브 RGBA 투명 출력, 네이티브 2K(2048² 기본, 종횡비 프리셋 최대 2752×1536). [L17][L16][L19]
- **Turbo 차이:** 8 step, CFG 1 기본, 권장 스케줄이 체크포인트에 저장돼 `num_inference_steps` 만 바꿔서는 덮이지 않는다(호출 시 `sigmas` 로 덮을 수 있으나 다른 스케줄은 평가되지 않았다). prefix KV 캐시로 텍스트·레퍼런스 컨텍스트를 스텝 간에 재사용한다. [L16]
- **AA 점수:** AA 는 원본 오픈웨이트 `Qwen-Image-2.1` 을 T2I 1042(±12)·편집 1081(±13)로 올린다. Turbo 항목은 Alibaba Cloud API(`qwen-image-2.1-turbo`, 1024², 프롬프트 보강 `direct`)의 결과로 T2I 1029(±12)·편집 1064(±14)이고 오픈웨이트 링크가 없다 — 오픈웨이트 Turbo 의 AA 점수는 없으며 조건이 달라 직접 비교도 못 한다. [L8][L9]
- **권장 설정:** ComfyUI Turbo 템플릿(`Qwen Image 2.1 Turbo: Text to Image` / `Image Edit`), 8 step · CFG 1 · euler · 고정 `ManualSigmas`(스텝만 올리지 말 것). 편집은 `image_1` 이 편집 대상이고 나머지 레퍼런스를 `<image2>` 처럼 번호로 지칭한다. 투명 PNG 는 원본 카드의 권장 형식 `This is an RGBA image with transparency. … The image has alpha channel and the background is transparent.` 를 쓴다. [L19][L17]
- **편집 비용:** 편집 캔버스는 첫 레퍼런스(`image_1`) 크기를 따르고 템플릿 기본 `resolution` 0 은 원본 픽셀을 유지한다 — 3000×4000 사진은 약 12MP 로 샘플링되어 RTX 5090 에서 약 6 s/it, `resolution` 1024(약 1MP)는 약 0.3 s/it 다. 입력 크기를 제한하지 않으면 비용이 커진다. [L19]
- **특장점:** 편집 기능 구성(마스크·동그라미·레퍼런스 10장·RGBA)이 넷 중 가장 넓고, 8 step 고정 스케줄이라 반복 작업에 현실적이다. [L17][L16]
- **약점·주의:** 원본 대비 API Turbo 의 AA 점수가 T2I 약 14, 편집 약 17 낮다(조건이 달라 참고용). 순정 VAE 는 디테일에 체커보드 무늬가 끼고 fp16 에서 NaN 이 난다고 카드가 적는다 — 교체 부품 참조. [L8][L9][L20]
- **라이선스:** Qwen Research License — 비상업 연구·평가 한정이고 상업 사용은 별도 계약이다. gated 는 아니다. HF `license` 태그는 `other`(카드 표기 `qwen-research`)다. [L16][L17][L1]
- **같이 쓸 부품:** `madebyollin/texture-fix-vae-for-qwen-image-2.1` — 체커보드 무늬와 fp16 NaN 을 고친 VAE 파인튜닝. rFID 3.38 → 2.07(COCO val2017 256²), PSNR 33.29 → 32.73, LPIPS 0.0357 → 0.0384 로 지각 품질을 얻고 픽셀 정확도를 조금 내준다. NaN 은 185개 스트레스 입력 중 75 → 0 건이며 fp16 에서만 문제라 bf16 로 돌리면 체커보드 개선이 핵심이다. `Load VAE` 에서 순정 `qwen_image_2.1_vae_bf16.safetensors` 대신 고르고 `--fp16-vae` 도 쓸 수 있다. 라이선스는 Qwen Research 다. [L20]

### 2.3 MOSS-Image-SFT + 4-step LoRA

**리포·파일** [L6][L25][L26]

| 역할 | 리포 ID | 쓸 파일 | 크기(GB) |
| --- | --- | --- | --- |
| SFT 원본 (diffusers custom pipeline) | `OpenMOSS-Team/MOSS-Image-SFT` | `pipeline_moss_image` | — |
| ComfyUI 패키지 | `Comfy-Org/MOSS-Image` | `diffusion_models/moss_image_sft_bf16.safetensors` | 10.16 (int8 5.41) |
| | | `text_encoders/qwen3.5_9b_int8_convrot.safetensors` | 9.75 (bf16 19.31 / w4a8 7.34) |
| | | `vae/flux2-vae.safetensors` | 0.34 (`flux2-vae_small` 0.25) |
| 4-step LoRA | `akhaliq/MOSS-Image-SFT-4-steps` | `moss_image_sft_4step_v2.0.safetensors` (= `lora.safetensors`, fp32 rank 128) | 1.19 |
| 3-step 시안용 | 같은 리포 | `lora_3step.safetensors` | 1.19 |
| fp32 병합본 | 같은 리포 | `moss_image_sft_4step_v2.0_fp32.safetensors` | 20.33 |

**공개일·인기도**

| 리포 | 공개 | HF 등록 | dl 30일 (누적) / likes | gated |
| --- | --- | --- | --- | --- |
| `OpenMOSS-Team/MOSS-Image-SFT` | 2026-10-16 | 2026-10-11 | 16,757 / ♥871 | 없음 |
| `OpenMOSS-Team/MOSS-Image-Base` | 2026-10-16 | 2026-10-11 | 10,657 / ♥606 | 없음 |
| `Comfy-Org/MOSS-Image` | — | 2026-10-16 | 4,215,132 / ♥571 | 없음 |
| `akhaliq/MOSS-Image-SFT-4-steps` | — | 2026-10-16 | 49,021 / ♥80 | 없음 |

공개일은 OpenMOSS README 의 소식 항목이다(Base·SFT 동시). [L1][L22]

- **사양:** 5B single-stream DiT(42층), Qwen3.5-9B 인코더, FLUX.2 VAE, 프롬프트 약 4K 토큰. T2I 전용이라 레퍼런스 입력이 없다. 기본 샘플링은 flow-matching Euler 50 step · CFG 3 · shift 5 이고 negative 브랜치는 layer 22 를 건너뛴다. [L22][L21]
- **기능:** 자연어·태그·JSON 레이아웃 프롬프트. 레이아웃은 `summary.caption` 과 `items`, `bbox_format: "yxyx"`, `bbox_coord_space: "abs_centralized"` 로 쓰고 ComfyUI 에는 `MOSS-Image Layout Prompt` 노드가 있다. [L21][L11][L24]
- **벤치마크:** LLTB Mean-6 96.3 은 오픈웨이트 최고(가장 긴 구간 영어 97.1 / 중국어 92.4), RealLayoutArena 1698.70 은 2위(1위 GPT Image 2 1844.35)다. 수치는 모두 개발팀의 기술 보고서·블로그가 보고한 것이고 AA 의 T2I·편집 리더보드에는 올라 있지 않다. [L23][L8][L9]
- **권장 해상도:** 사용자 가이드는 1M·1.5M·2M 픽셀을 권하고 0.25M~4M 로 외삽한다고 적는다. 4-step LoRA 는 1024² 이하 4 step, 약 1536 폭 6 step, 2048² 8 step 이며 1024² 를 넘겨 4 step 을 쓰면 뿌옇고, 높은 해상도일수록 긴 프롬프트가 낫다. [L22][L26]
- **권장 설정(ComfyUI 0.42.0 이상):** `moss_image_sft_bf16` + `qwen3.5_9b_int8_convrot`(CLIPLoader type `moss_image`) + `flux2-vae`, `LoraLoaderModelOnly` 로 `moss_image_sft_4step_v2.0.safetensors` strength 1.0, KSampler euler / simple / 4 step / CFG 1.0, negative 없음. ComfyUI MOSS 템플릿의 기본값(int8 SFT · w4a8 인코더 · small VAE, 25 step · CFG 2.5 · `er_sde`)이나 MOSS 기본 step·CFG 를 이 LoRA 와 쓰면 뭉개진다. 3 step 드래프트는 A100 1024² 약 4.2초로 4 step(약 5.6초)보다 약 25% 빠르고, 2 step 은 같은 리포에 실패한 실험으로 남아 있다. [L26][L24]
- **정밀도(코드로 확인):** ComfyUI 의 `MOSSImage.supported_inference_dtypes` 는 `[bfloat16, float32]` 이고 `unet_dtype()` 은 `--fp32-unet` 이 없으면 H100 처럼 bf16 을 지원하는 GPU 에서 bf16 을 고른다. 그래서 fp32 병합본(20.33GB)을 불러도 추론 dtype 은 bf16 이라 이득이 없다. `--fp32-unet` 은 프로세스의 모든 모델에 적용되므로 쓰지 않는다. 카드가 평가한 구성은 diffusers 에서 bf16 원본 + fp32 LoRA 비병합(`apply_lora.py`)이고, ComfyUI 는 LoRA 를 가중치에 패치하면서 bf16 으로 되돌릴 때 stochastic rounding 을 쓴다. [L10][L26]
- **특장점:** 넷 중 유일한 Apache-2.0, 긴 영·중 글자와 JSON 레이아웃 제어, 4 step. 이 LoRA 는 같은 프롬프트·시드 비교에서 "62% / 38%" 같은 숫자 글자를 유일하게 정확히 그렸다고 카드가 보고한다(저자 자체 비교). [L21][L26]
- **약점·주의:** (1) 편집 불가(비공식 편집 LoRA 는 있으나 제외). (2) SFT 는 하늘·안개·벽 같은 매끄러운 영역에 세로 줄무늬(banding)를 그린다 — LoRA 절의 DeBand·Destripe. (3) LoRA 를 bf16 가중치에 병합하면 미세 글자가 먼저 상한다고 카드가 경고한다. (4) 속도는 A100 1024² 4 step 약 5.6초와 약 11초가 한 카드에 함께 적혀 있어 조건이 불분명하다. (5) 한국어 렌더링은 확인 불가. [L21][L26][L50]
- **라이선스:** Apache-2.0(가중치·번들 코드), 4-step LoRA 도 Apache-2.0 이고 카드는 상업 사용이 가능하다고 적는다. HF `license` 태그도 두 리포와 `Comfy-Org/MOSS-Image` 모두 `apache-2.0` 이다. [L21][L26][L1]
- **같이 쓸 부품(선택):** `cyberlangke/moss-image-mini-encoder`(Apache-2.0) — 9B 인코더를 Qwen3.5-0.8B/2B/4B + 선형 투영으로 바꾼다. HF 등록 2026-10-29, 0 / ♥1(집계 안 됨 가능). 4B w4a8 4.03GB(카드 표기 3.84GB), 0.8B w4a8 1.00GB(0.96GB). 작성자 측정 end-to-end 는 9B 33.1초 → 4B 23.6초(4-step LoRA, 1024²)지만 카드가 순수 인코딩은 전체의 0.2~0.5% 이고 나머지는 샘플링과 이미지마다의 모델 장착·해제라고 적는다 — 모델이 상주하는 H100 에서는 속도가 아니라 메모리(9.75 → 4.03GB)가 이득이다. 작을수록 고유명사 인식이 떨어지고(4B 는 작품 소속만, 0.8B 는 인식 못 함) 0.8B 는 긴 JSON 에서 글자 한 자씩 틀린다(4B 는 없음). 어댑터는 학생 크기·양자화와 짝이 맞아야 하고 `MossCLIPLoader` 노드가 필요하다. [L27][L6][L1]

### 2.4 Fibo 2.0 Edit Turbo

**리포·파일** [L6][L28][L30][L67]

| 역할 | 리포 ID | 쓸 파일 | 크기(GB) |
| --- | --- | --- | --- |
| Edit Turbo 원본 (diffusers) | `briaai/Fibo-2.0-edit-turbo` | `BriaFibo2Pipeline` (`diffusers>=0.42.0`) | — |
| ComfyUI 재패키지 | `Comfy-Org/Fibo-2.0` | `diffusion_models/fibo2_edit_turbo_int8_convrot.safetensors` | 8.41 (bf16 16.45) |
| | | `text_encoders/qwen3vl_4b_int8_convrot.safetensors` | 4.86 (bf16 8.88) |
| | | `vae/flux2-vae.safetensors` | 0.34 |
| 선택: 프롬프트 보강 | `Comfy-Org/Qwen3-VL` | `qwen3vl_8b_int8_convrot.safetensors` (ComfyUI 템플릿이 사용) | 9.35 |
| dev 용 가속 LoRA | `Comfy-Org/Fibo-2.0` | `loras/fibo_2.0_turbo_lora_avg_rank_270_bf16.safetensors` | 1.99 |

**공개일·인기도**

| 리포 | 공개 | HF 등록 | dl 30일 (누적) / likes | gated |
| --- | --- | --- | --- | --- |
| `briaai/Fibo-2.0-edit-turbo` | 2026-10-19 (HF 등록일, 아래 참고) | 2026-10-19 | 1,905 / ♥153 | auto |
| `briaai/Fibo-2.0-dev` | 2026-10-18 (HF 등록일) | 2026-10-18 | 1,942 / ♥197 | auto |
| `Comfy-Org/Fibo-2.0` | — | 2026-10-20 | 264,445 / ♥224 | 없음 |

개발사의 공지 일자는 확인하지 못했다. HF 등록일은 위와 같고 AA 의 `releaseDate` 는 2026-10-20 이다. [L1][L8]

- **사양:** 8B flow matching. 44블록 single-stream DiT 가 이미지 토큰을 처리하고, 2층 Perceiver resampler 가 VLM 출력을 256~512개 gist 토큰으로 압축해 앞에 붙이며, VLM 내부 층이 5개 블록에 cross-attention 으로 직접 들어간다. 인코더 Qwen3-VL-4B-Instruct, VAE FLUX.2. Edit Turbo 는 dev 에서 증류한 같은 아키텍처다. [L28]
- **스텝:** `num_inference_steps=4`, `guidance_scale=1.0` 이고 `negative_prompt` 는 효과가 없다. dev 는 50 step · guidance 5.0 이다. 카드는 Edit Turbo 가 파인튜닝용이 아니니 dev 에서 시작하라고 안내한다. [L28][L29]
- **기능:** 지시 편집, 마스크 편집(흰 영역만 재생성), 레퍼런스 최대 4장(diffusers). ComfyUI `TextEncodeFibo2` 노드는 이미지 슬롯 16개를 받고 `width`·`height` 0 이면 첫 이미지 종횡비의 약 1MP 학습 크기를 쓴다. 파이프라인에 `fonts`(폰트 파일)를 넘기면 모델이 글자를 작은 이미지로 그려 참고한다. [L28][L32]
- **학습 데이터·해상도:** 라이선스를 받은 데이터만 쓰고(Bria 의 약 10억 장 데이터셋에서 선별) 1,000단어가 넘는 구조화 JSON(VGL) 캡션으로 학습했다. 약 1MP, 16의 배수 크기를 권한다. [L28][L29]
- **AA 점수:** 편집 1088(±14, 오픈웨이트 1위, AA 편집 항목의 주석이 `briaai/Fibo-2.0-edit-turbo` 를 가리킨다), T2I 1039(±12, 오픈웨이트 3위, T2I 항목은 `Fibo-2.0-dev` 로 링크). T2I 는 Klein 1043·원본 Qwen 1042 와, 편집은 원본 Qwen 1081 과 신뢰구간이 겹친다. [L8][L9]
- **권장 설정:** ComfyUI 0.43.0 이상, CLIPLoader type `fibo2`, 템플릿 `Fibo 2.0 Turbo: Image Edit` — `fibo2_edit_turbo_int8_convrot` + `flux2-vae`, KSampler 4 step · CFG 1 · euler · simple. 템플릿의 기본 인코더는 `qwen3vl_4b_bf16`(8.88GB)이고 int8(4.86GB)로 바꾸면 메모리가 준다. 프롬프트는 VGL JSON 이 최대 성능이다 — diffusers 경로는 `bria-vgl` 이 Gemini API 키를 요구하고, ComfyUI 템플릿은 `TextGenerate` 가 로컬 Qwen3-VL 8B(`qwen3vl_8b_int8_convrot`)로 지시문을 구조화 캡션으로 바꿔 넣는다(끄면 원문이 그대로 들어간다). 카드의 diffusers 예시는 Hopper(H100)에서 FlashAttention-3(`pipe.transformer.set_attention_backend("_flash_3_varlen_hub")`)이 더 빠르다고 안내한다. [L28][L32][L65]
- **T2I 로 쓰기:** 카드는 Edit Turbo 가 편집 전용이고 T2I 는 dev 를 쓰라고 적는다. 이미지 없이 호출하면 4 step · CFG 없는 T2I 가 된다는 것은 커뮤니티 확인이다(`lvladikov/FIBO2-Edit-Turbo-T2I`: 평문·VGL 프롬프트, 약 1MP, 22개 예시). 정량 비교는 없다. [L28][L31]
- **특장점:** 편집 품질 최상위(AA), 4 step, 마스크 편집, 라이선스된 데이터 학습, 구조화 프롬프트로 속성 단위 제어. [L28][L9]
- **약점·주의:** 비상업 라이선스, 원본 gated, 글자 렌더링은 개선을 주장하나 정량 수치 없음, 멀티턴 편집·배경 제거·제품샷·마스크 지우기·아웃페인팅은 "coming soon" 으로만 있다. [L28]
- **라이선스:** CC BY-NC 4.0 — 비상업 한정이고 상업 사용은 Bria 와 별도 계약이다. `briaai` 리포는 gated, `Comfy-Org/Fibo-2.0` 재패키지는 gated 가 아니지만 라이선스는 같다. HF `license` 태그는 `briaai` 리포가 `other`, 재패키지가 `cc-by-nc-4.0` 이다. [L28][L30][L1]
- **같이 쓸 부품:** 프롬프트 보강용 `qwen3vl_8b_int8_convrot`(선택, 끄고 쓰면 메모리 9.35GB 절약). `fibo_2.0_turbo_lora_avg_rank_270_bf16` 은 Edit Turbo 를 dev 에 얹는 차분이라 Edit Turbo 에는 필요 없다. [L32][L33]

### 2.5 H100 1대 메모리 계산

| 구성 | 가중치 구성 (GB) | 소계 (GB) |
| --- | --- | --- |
| FLUX 3 Klein 증류판 | DiT int8 5.83 + 인코더 int8 4.86 + VAE 0.34 + upsampler int8 9.75 | 20.78 |
| Qwen-Image-2.1-Turbo | DiT int8 7.26 + 인코더 `qwen3vl_8b` int8 9.35 + VAE 0.68 | 17.29 |
| Fibo 2.0 Edit Turbo | DiT int8 8.41 + 인코더 `qwen3vl_4b` int8 4.86 + VAE 0.34 | 13.61 |
| MOSS-Image-SFT + 4-step | DiT bf16 10.16 + LoRA fp32 1.19 + 인코더 `qwen3.5_9b` int8 9.75 + VAE 0.34 | 21.44 |
| **합계 (공유 없음)** | | **73.12** |
| 공유 시 | `qwen3vl_4b` int8 한 벌(−4.86), `flux2-vae` 한 벌(−0.68) | **67.58** |
| 80GB 대비 여유 | 80 − 73.12 / 80 − 67.58 | 6.88 / 12.42 |

크기는 HF 트리 API 의 바이트 수를 1e9 로 나눈 값이다. [L6]

- **활성 메모리는 별도다.** BFL 카드의 레퍼런스 코드 피크(B200, 1024², upsampler 끔)는 BF16 31GB·FP8 26GB·NVFP4 25GB 이고 upsampler 를 켜면 80GB GPU 에서 약 28GB 가 더 든다. 같은 구성의 파일 합(BF16: DiT 11.10 + 인코더 8.88 + VAE 0.34 = 20.32GB)과의 차가 약 11GB 이므로 1MP 에서도 가중치 밖 메모리가 10GB 안팎일 수 있다(추정). 해상도·레퍼런스 수에 따라 늘고, Qwen 편집은 캔버스 크기가 비용을 지배한다. [L12][L19]
- **표는 int8 인코더로 잡았다.** ComfyUI 템플릿 기본값과 다른 곳은 Klein upsampler(템플릿 w4a8 6.72GB, 표보다 3.03GB 작음), MOSS 인코더(템플릿 w4a8 7.34GB, 2.41GB 작음), Fibo 인코더(템플릿 bf16 8.88GB, 4.02GB 큼)다. Qwen 템플릿은 int8 이고, 4-step LoRA 카드가 평가한 MOSS 인코더도 int8 이다. [L15][L24][L32][L19][L26]
- **더 줄이는 선택지:** Qwen 인코더 w4a8 9.35 → 6.31(−3.04), MOSS 인코더를 mini-encoder 4B w4a8 로 바꾸면 9.75 → 4.03(−5.72). [L6][L27]
- **프롬프트 보강은 끄고 계산했다.** Fibo 템플릿의 Qwen3-VL 8B int8(9.35GB), Qwen PE 인코더 int8(9.47GB)을 켜면 더 든다. MOSS 템플릿의 보강은 이미 로드한 Qwen3.5 인코더를 재사용한다. [L32][L19][L24]
- **공유는 가정이다.** Fibo 와 MOSS 패키지의 `flux2-vae` 는 LFS 해시가 같다. Klein 의 `flux2-vae`·`qwen3vl_4b_int8_convrot` 는 Fibo 쪽과 이름·크기가 같지만 Klein 리포가 gated 라 해시가 가려져 비교하지 못했다(`qwen3vl_4b_bf16` 은 크기가 달라 다른 파일이다). Fibo 의 선택 보강 인코더 `qwen3vl_8b_int8_convrot` 는 Qwen 패키지의 같은 이름 파일과 해시가 같다. CLIPLoader type 이 `flux3`/`fibo2`/`moss_image`/`qwen_image` 로 달라서 ComfyUI 가 한 벌만 올릴지는 확인하지 못했다. [L67][L10]
- **상주가 필수는 아니다.** ComfyUI 는 필요한 메모리가 모자라면 로드된 모델을 내리고(`model_management.free_memory`) 다시 쓸 때 올린다. 4개를 항상 상주시킬지는 지연과 메모리의 교환이다. [L10]

---

## 3. LoRA 정리

### 3.1 FLUX 3 Image Klein

- **호환 주의:** 공식 카드는 LoRA 학습을 `-base`(50 step)로 하라고 안내하고 표의 LoRA 도 대부분 `-base` 로 학습했다. 증류판(16 step) 사용이 카드에 적힌 것은 FontBox·SimpleTuner(증류판으로 학습)와 Outpaint(Base 로 학습, 증류판 INT8 로 시험)뿐이고 나머지는 증류판 동작이 미기재다. [L12][L34][L36][L37][L39]
- Civitai 의 베이스 값은 `Flux.3 Klein` 과 `Flux.3 Klein-base` 로 나뉘지만 학습 베이스와 항상 일치하지는 않는다(Outpaint 는 Base 학습인데 `Flux.3 Klein` 으로 등록). 이 표는 `Flux.3 Klein` 값 LoRA 28개 전부와 `Flux.3 Klein-base` 값 14개를 확인한 결과다. [L4][L39]

| LoRA | 용도 | 학습 대상 | 권장값·트리거 | 인기도 | 공개(등록)일 | 라이선스 | 주의 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Civitai `MoreReal` (id 2904424, NO8D) [L5] | 아무 이미지를 사실적인 사진으로 바꾸는 A2R | 미기재 | weight 0.6~0.9, 트리거 `Convert this image into a photograph`, step 미지정 | 모델 4,703 / ♥341 (F3K 버전 663 / ♥46) | F3K 2026-10-18 | Civitai `allowCommercialUse`=[RentCivit] · `allowDerivatives`=false | 같은 페이지에 MOSS-image(2026-10-21)·Qwen-image-2.1(2026-10-01)·Krea2edit(2026-08-31) 버전도 있다. Patreon 유료 비공개판이 따로 있다. 정량 근거 없음 |
| `akhaliq/flux-3-image-klein-angles-lora` [L34] | 카메라 각도 변환(방위 8 × 높이 5 × 거리 `close-up` 옵션) | `-base` (합성 3D 렌더 4,000쌍, rank 16, 2,000 step) | `<mva> {azimuth} view, {elevation} shot[ close-up]`, 50 step, upsampler 를 빼고 원문 프롬프트 | 1,255 / ♥3 | 2026-10-15 | FLUX Kommunity (카드) | 사람·동물은 안정적이나 사물은 환각 대상으로 바뀔 수 있다. 증류판 16 step 동작은 카드에 없다 |
| `Felox/restore_skin` [L35] | 반복 VAE 통과로 잃은 피부 고주파(모공·잔털) 복원, 색·조명은 그대로 | `-base` (rank 32, 2,000 step, 2048) | 프롬프트 `Restore Skin` 또는 임베딩 `restore_skin.safetensors`, 고주파 분리 → 모델 → 재합성 워크플로(`restore_skin_workflow.json`) | 188 / ♥1 | 2026-10-16 | FLUX Kommunity (카드) | 피부만 학습해 머리카락·옷·배경에 원치 않는 질감이 생길 수 있다. 심한 JPEG 블록·모션 블러는 범위 밖. 증류판 동작 미기재 |
| `lilylilith/FLUX.3_Klein_FontBox` [L36] | 글자 편집 — 정렬(좌·중·우)·크기·위치·가짜 굵게/기울임·세로 스케일 | 증류판 (`flux-3-image-klein`) | JSON + 바운딩박스 프롬프트가 입력이고 컴패니언 ComfyUI 노드 `ComfyUI_FontBox` 를 쓴다. 1MP 이상(2MP 권장) | 32 / ♥2 | 2026-10-24 | 카드 `apache-2.0` — Klein 파생물이라 Kommunity 조건과 충돌할 수 있다(확인 불가) | 개념 증명이라 불안정하고 로고·워드마크는 안 되며 영어 위주다. 지정하지 않은 글자까지 움직이면 "keep" 마커로 보정한다 |
| `SimpleTuner/flux-3-klein-image-photo-aesthetics-distilled-assisted-1024-v2-kohaku-fa` [L37] | 사진 미감 보정(카드에 용도 설명 없음) | 증류판 (rank 32, 50,000 step, 29,760장, 1MP) | 검증 설정 16 step · CFG 1 · 512²/1024², 트리거 미기재 | 1,102 / ♥1 | 2026-10-16 | 카드 `license: other` (조건 미기재) | 데이터 출처·평가 정보가 없고 검증 프롬프트 없이 학습했다. 같은 리포군에 512 판·v1 판이 있다 |
| Civitai `FLUX 3 Image Klein Outpaint LoRA` (id 3003865, AusBoss) [L4][L39] | 어느 쪽으로든 그림 확장, 기울인 사진의 회색 모서리 채우기 | `-base` (rank 32, 102쌍, 1,000 step), 증류판 INT8 16 step · CFG 1 로 시험 | strength 1.5(1.0 도 가능), 회색 `#808080` 패딩, 트리거 문장 `Outpaint the image: replace the solid gray areas with a seamless continuation of the scene, keeping the existing picture unchanged.` | Civitai 986 / ♥47 · HF `ausboss/FLUX-3-Image-Klein-Outpaint-LoRA` ♥23 | v1.0 2026-10-16 (HF 2026-10-15) | FLUX Kommunity (HF 카드), Civitai `allowCommercialUse`=[RentCivit] · `allowDerivatives`=true | AusBoss 노드 2.13.0 이상과 원본 픽셀을 덮어 붙이는 후처리(Stitch Inpaint)가 전제다. LoRA 없이는 40회 중 36회 그림을 확대하거나 밀어버린다(작성자 측정) |
| Civitai `360 Degree [Flux]` (id 682349, denrakeiw) [L4] | 360° 파노라마(2:1) 생성 | `-base` | 트리거 `create a 360 hdr`, 2048×1024(VRAM 이 되면 4096×2048) | 모델 14,678 / ♥1,283 (Klein 버전 248 / ♥26) | Flux_3_Klein 2026-10-16 | Civitai `allowCommercialUse`=[Image, RentCivit, Rent] · `allowDerivatives`=false | 좌우 이음매가 완전히 사라지지 않는다 — 아래 Seamfix 와 짝이다 |
| Civitai `360 Flux 2/3 Klein Seamfix` (id 2709848, denrakeiw) [L4] | 360° 이미지의 이음매 보정 | 미기재 | 설명은 "360 ComfyUI 워크플로에서 이음매를 고치는 LoRA" 한 줄이고 강도 미기재 | 모델 631 / ♥55 (Klein 버전 163 / ♥12) | Flux_3_Klein 2026-10-16 | Civitai `allowCommercialUse`=[Image, RentCivit, Rent, Sell, SellMerge] · `allowDerivatives`=true | 360° LoRA 없이는 쓸 곳이 없다 |

**제외한 것**

- `NoiseToNova/Flux-3-Klein-turbo-pdd-4_8-steps` (HF 2,650 / ♥4, 2026-10-26): Base 50 step 을 8·4 step 으로 줄이는 PDD 가속 LoRA(CFG 증류 포함)다. 확정 구성은 이미 16 step 증류판이라 대상이 아니고, 카드는 이미지 편집 품질이 Base 보다 떨어진다고 적는다. [L38]
- 성인물 LoRA(`B!G BODY – Figure Enhancer | FLUX 3 Klein v1`, `Flux3Klein Big Breasts Text2Image`, `Party Time - Female Nudity` 등). [L4]
- 스타일 취향 LoRA 는 기능 보강이 아니라서 뺐다. 다운로드 상위는 `80s Fantasy Movie` 44,660 / ♥3,031, `Dark Ghibli Fairytales` 25,762 / ♥1,974, `Octane Render` 14,279 / ♥870(모델 합산 값)이다. `Flux.3 Klein-base` 값 14개도 스타일·캐릭터·팬아트 위주다(`Radiance Chrome Voluptuous` 13,568 / ♥740 등). [L4]

### 3.2 Qwen-Image-2.1-Turbo

- **호환 주의:** 대부분 원본 `Qwen/Qwen-Image-2.1`(25~30 step, CFG 1~3)로 학습·시험했다. Turbo(8 step · CFG 1 · 고정 스케줄)로 학습한 것은 Character-Swap 하나이고, AusBoss 의 Consistency·Restore·Outfit Swap 은 Turbo 또는 Viggle Turbo 8 step 시험을 설명에 적었으며, AnyAngle 카드는 Turbo 사용 시 품질이 약간 떨어진다고 하고, BFS 워크플로는 원본 + Pruna 8-step 가속 LoRA 다. 나머지는 Turbo 와 겹친 검증이 없다. [L40][L41][L43][L4]
- 카드에 Apache-2.0·MIT 로 적힌 LoRA 도 원본의 Qwen Research License(비상업 연구·평가)가 파이프라인에 남는다고 보는 편이 안전하나 명시적 근거는 없다. [L16][L17]

| LoRA | 용도 | 학습 대상 | 권장값·트리거 | 인기도 | 공개(등록)일 | 라이선스 | 주의 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `Alissonerdx/BFS-Best-Face-Swap` [L40][L7] | 얼굴·머리·몸 교체 — Qwen 2.1 용 `bfs_head_v1.1_qwen_2.1`(권장), `bfs_head_v1.1_alternative_qwen_2.1`(표정 전이 강함, 머리 각도 오차 약 1° 증가), `bfs_body_swap_v1.0_qwen_2.1`(몸 전체) | 원본 `Qwen/Qwen-Image-2.1` | strength 1.0, 입력 순서 고정(Image 1 = 장면의 몸·배경, Image 2 = 참조 얼굴), 프롬프트 `head_swap: start with <image1> as the base image, …`(카드 제공). 몸 교체는 장면 약 2MP · 참조 약 0.59MP(전신·정면·단색 배경) | HF 258,636 (누적 1,168,335) / ♥1,492 (FLUX.2 Klein·Qwen Edit·Krea 2·LTX-2 파일까지 합친 리포 값) · Civitai `BFS - Best Face Swap` (id 2027766) 104,099 / ♥3,197 (Qwen 2.1 Head Swap v1.1 7,954 / ♥405, Body Swap v1.0 4,686 / ♥274) | 리포 등록 2025-11-07, Qwen 2.1 파일은 head v1 2026-09-25 · v1.1 과 alternative 2026-09-26 · body 2026-09-27(커밋 기록). Civitai v1.1 2026-09-25, body 2026-09-27 | MIT (HF 태그), Civitai `allowCommercialUse`=[Image, RentCivit, Rent, Sell, SellMerge] · `allowDerivatives`=true | 동의 없는 인물·공인에 쓰지 말라고 카드가 명시한다. 작은 얼굴·극단 각도·가림·강한 조명 변화에 약하고 성별·나이·체형이 크게 다르면 실패한다. 워크플로에 Pruna 8-step 가속 LoRA 옵션이 있다(원본 + 가속 경로). Civitai 판은 `nsfw` 플래그가 true 다 |
| `akhaliq/Qwen-Image-2.1-Turbo-Character-Swap-LoRA` [L41] | 장면의 인물을 레퍼런스 캐릭터로 교체(장면 유지) | **Turbo** (rank 32, lr 1e-4, 2,016 step, DiffSynth-Studio) | 입력 2장, `Swap the person in Picture 1 with the character in Picture 2. Keep the background, lighting and everything else unchanged.`, 8 step | 0 / ♥5 (집계 안 됨 가능) | 2026-10-10 | 카드 `license: other` (조건 미기재) | 단순 배경의 단일 캐릭터 레퍼런스에 강하고 캐릭터 시트·기계/로봇 레퍼런스는 v1 에서 약하다. 학습 데이터는 296 트리플릿(76 + 220)과 보존 예시 40 |
| `gribbliest/qwen-image-2.1-qma-camera-angles` [L42] | 카메라 각도(방위 8 × 높이 4 × 거리 3 = 96 조합) | 원본 (rank 64, 3,000 step, 사진 + Blender 렌더) | `<qma> {azimuth} {elevation} {distance}`, strength 1.0, 30 step · CFG 3 · euler / simple, 약 1MP(미리보기 768), 소스 이미지 필수, CoreyCorza 드래그 노드 | 10,782 / ♥50 | 2026-10-13 | Apache-2.0 (카드) | 소스에 없는 면(뒷모습)은 추측이고 넓은 풍경의 큰 궤도는 90° 에 못 미칠 수 있다. 쿼터 뷰·고각·거리 변경이 가장 안정적이다. Turbo 와 겹친 검증은 없다 |
| `lilylilith/QI_2.1_AnyAngle` [L43] | 임의 각도 — 3D 스플랫/모델에서 Blender 로 뽑은 새 각도를 원본 화풍에 맞춰 전이 | 원본 | `Change the camera angle from <image2> to <image1>.`, strength 1, CFG 3.0, 20 step 이상. Turbo 를 쓰면 품질이 약간 떨어진다고 카드가 적는다 | 16,677 (누적 18,298) / ♥181 · Civitai `AnyAngle` (id 2970214) 1,336 / ♥86 | 2026-09-28 (Civitai AnyAngle_V1 2026-09-28) | Apache-2.0 (카드) | Tripo Splat·Trellis2 같은 3D 생성기와 Blender 가 필요하고, 스플랫이 거칠면 배치·얼굴이 깨진다 |
| `WarmBloodAban/Qwen-Image-2.1-LoRAs` [L44] | `Qwen2.1_Anime_consistency`(애니 편집의 캐릭터 일관성), `Qwen2.1_Anything2RealCharacters`(임의 화풍 → 실사 인물) | 원본 (4뷰 캐릭터 시트·표정 편집 / 실사 인물 + 표정 제어 참조군) | weight 0.6~0.8 부터, Euler · `FlowMatchEulerDiscreteScheduler`, step·CFG 는 공식 권장을 따름 | 32,324 (누적 45,959) / ♥134 | 2026-09-20 | Apache-2.0 (카드) | Anime_consistency 는 실험 단계라 안정성을 보장하지 않는다 |
| `prithivMLmods/Qwen-Image-2.1-Natural-Exposure-LoRA` [L45] | 노출 보정(균형 잡힌 중립 노출, 색·디테일 유지) | 원본 (38쌍, rank 16, 4,000 step) | 트리거 프롬프트 `Transform the image with balanced neutral exposure`, 노출 편차가 큰 이미지에서 | 18,997 (누적 24,574) / ♥62 | 2026-09-23 | 카드 `qwen-research` | 실험 프리뷰 — 극단 노출·복잡 조명·고대비·강한 색 캐스트에서 아티팩트가 난다 |
| Civitai `Qwen Image 2.1 Consistency LoRA` (id 2969143, AusBoss) [L4] | 편집 때 원본 프레임 유지(밀림·확대 방지, 국소 편집에서 건드리지 않은 부분 보존) | 미기재 (원본 설정 25 step 으로 시험) | 트리거 없음, `LoraLoaderModelOnly` strength 1.0, `Text Encode Qwen Image 2.1` 의 `resolution` 0 으로 소스를 `image_1` 에 넣고 그 latent 로 샘플링, 25 step · CFG 1 · euler / simple. Turbo 8 step 2MP 에서도 시험(편집 8건 모두 1.6px 이내) | 7,502 / ♥281 · HF `ausboss/Qwen-Image-2.1-Consistency-LoRA` ♥127 | v1.0 2026-09-27 (HF 2026-09-27) | Civitai `allowCommercialUse`=[RentCivit] · `allowDerivatives`=true, 설명이 Qwen Research License(비상업)를 명시 | 4-step LoRA·CFG>1 은 미검증이다. 이전 포즈를 붙잡아 새 포즈·돌린 머리에는 꺼야 한다. Civitai 판은 step 1,500, 더 타이트한 step 2,000 은 HF 에 있다 |
| Civitai `Qwen Image 2.1 Restore LoRA` (id 2989697, AusBoss) [L4] | 작거나 낡은 사진을 복원할 때 원본 업스케일의 과한 질감(거친 피부·없던 모공) 완화 | 미기재 | 트리거 없음, strength 1.0(흐린 사진은 0.5), 입력을 약 2MP 로 키워 `image 1` 에 넣고 `Restore the photo: remove blur, noise and compression artifacts and recover sharp, natural detail, keeping the same composition, people and colors.`, Viggle Turbo 8 step 또는 25 step | 5,460 / ♥234 · HF `ausboss/Qwen-Image-2.1-Restore-LoRA` ♥51 | v1.0 2026-10-07 | Civitai `allowCommercialUse`=[RentCivit] · `allowDerivatives`=true | 재그림이지 복원이 아니다 — 디테일은 지어낸 것이고 약 100px 의 작은 얼굴은 다시 그려진다. Civitai 판은 step 1,500, 피부 질감이 더 있는 step 1,250 은 HF 에 있다 |
| Civitai `Qwen Image 2.1 Outfit Swap Consistency LoRA` (id 2983159, AusBoss) [L4] | 의상만 교체(얼굴·머리·손·포즈·배경 유지) | 원본 INT8 convrot (ai-toolkit, rank 32, 66쌍, 1,000 step) | 트리거 없음, strength 1.0(0.5 면 그림이 다시 움직인다), `image 1` = 사람, `image 2` = 의상, `Dress the person in image 1 in the <outfit, in a few words> shown in image 2. Keep their face, hair, hands, pose and the background exactly the same.`, 25 step · CFG 1 (2MP 시험), Viggle Turbo 8 step 에서도 유지 | 4,028 / ♥180 | v1.0 2026-10-04 | Civitai `allowCommercialUse`=[RentCivit] · `allowDerivatives`=true | 일반 Qwen 보다 의상을 더 정확히 복사하지는 않는다 — 단추·벨트 오류, 격자무늬가 평평해짐, 원래 바지·벨트가 남기도 한다 |
| Civitai `Qwen Image 2.1 Outpaint LoRA — Extend Any Side` (id 2967375, AusBoss) [L4] | 한쪽·여러 쪽 그림 확장 | 원본 | v2.0 은 1~2MP, v1.0 은 약 1MP. 회색 `#808080` 패딩(변 길이 32 배수), Klein 판과 같은 트리거 문장, `resolution` 0, strength 1, 25 step · CFG 1, 원본 픽셀을 마지막에 덮어 붙임 | 3,663 / ♥174 (v2.0 3,471 / ♥171) · HF `ausboss/Qwen-Image-2.1-Outpaint-LoRA` ♥79 | v2.0 2026-09-27 | Civitai `allowCommercialUse`=[RentCivit] · `allowDerivatives`=true | `Set Latent Noise Mask` 로 알려진 영역을 고정하면 이음매에 사각형이 보인다. 유지 그림이 캔버스의 약 15% 미만이면 결과가 시드마다 크게 달라지니 두 번에 나눠 확장한다 |
| Civitai `Lenovo UltraReal` (id 1662740) · `NiceGirls UltraReal` (id 1862761), Danrisi [L4] | 기기·사진 질감 실사 | 미기재 | 설명(Qwen2.1 항목): CFG 3~4(이미지가 망가지면 1), beta 스케줄러, `res_2m` / `res_2s` / `res_multistep`, 다른 LoRA 와 병용 가능 | Lenovo 모델 214,215 / ♥5,758 (Qwen2.1 버전 18,350 / ♥408) · NiceGirls 모델 152,928 / ♥4,699 (v2 Qwen2.1 9,382 / ♥269) | Lenovo v1.0 2026-09-22 · NiceGirls v2 2026-09-23 | 두 모델 모두 Civitai `allowCommercialUse`=[Image, RentCivit, Rent, Sell, SellMerge] · `allowDerivatives`=false | 갤러리가 성인 이미지를 포함할 수 있다(`nsfw`=false 이나 API `nsfwLevel` 31). 권장 CFG 가 3~4 라 Turbo(CFG 1)와 겹친 검증이 없다 |

**참고: Turbo 체크포인트 대신 원본 + 가속 LoRA 로 가는 경로** (확정 구성은 Turbo 를 쓰므로 불필요)

| LoRA | 방식 | 인기도 | 공개(등록)일 | 라이선스 | 주의 |
| --- | --- | --- | --- | --- | --- |
| `PrunaAI/P-Q-Image-2.1` [L18][L46] | 원본에 얹는 5·6·8 step 가속 LoRA (ComfyUI 판은 `Comfy-Org/Qwen-Image-2.1` 의 `loras/` 에 재포장, CFG 1) | 377,263 (누적 525,104) / ♥187 | 2026-09-23 | 카드 `license: other` | — |
| `lightx2v/Qwen-Image-2.1-Lightning` [L46] | 4 step 증류 LoRA | 430,107 / ♥110 | 2026-10-13 | 카드에 라이선스 미기재 | — |
| `Viggle/Qwen-Image-2.1-viggle-turbo` [L46] | 40 → 6 step, CFG 제거 | 344,205 (누적 600,033) / ♥788 | 2026-09-22 | `qwen-research` | 카드가 가장 큰 차이로 작고 빽빽한 글자와 복잡한 편집을 든다 |
| `chriswritescode/Turbo8-LoRA-Qwen-Image-2.1` [L46] | 8 step (DMD2 + GAN) | 25,942 (누적 31,834) / ♥23 | 2026-09-27 | 카드 `license: other` | 글자 OCR 정확 일치가 95.0% → 75.0% 로 떨어진다 |

**제외한 것**

- `e-n-v-y/Qwen-Image-2.1-Fix` (HF 15,441 (누적 28,271) / ♥98, 2026-09-22 · Civitai `Qwen Image 2.1 Fix v2.0` 3,869 / ♥132): 카드가 "올바른 설정으로 쓰면 대부분의 생성 문제를 고친다, 설정은 워크플로 zip 참고" 한 줄뿐이고 설정·근거가 없다 → 확인 불가. [L47][L4]
- 성인물 LoRA(`f23gg/NSFW-LORA-Qwen-Image-2.1`, `chatrlabs/Qwen-Image-2.1-Uncensored-Omni-LoRA-v0.1`, Civitai `NSFW LORA | Qwen Image 2.1` 등). [L4][L66]

### 3.3 MOSS-Image-SFT + 4-step LoRA

- **호환 주의:** 스타일 LoRA 는 Base 로 학습하고 SFT 에서 30~50 step · CFG 3 로 평가한 것이 대부분이라 akhaliq 4-step(4 step · CFG 1)과 겹쳐 쓴 검증이 카드에 없다. 겹침이 확인된 조합은 color-depth control + darask0 4-step 어댑터, 그리고 DeBand 가 속도 LoRA 를 낮은 강도로 섞는 프리셋(lodestones 8-step 0.28~0.35 또는 darask0 4-step 0.35, 10~14 step)뿐이다. [L48][L50][L53]
- ComfyUI 에서는 PEFT 루트 파일이 아니라 `*-ComfyUI.safetensors` 를 쓰고 LoRA 로더의 CLIP strength 는 0 으로 둔다(axiomofmind). [L53]

| LoRA | 용도 | 학습 대상 | 권장값·트리거 | 인기도 | 공개(등록)일 | 라이선스 | 주의 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `darask0/MOSS-Image-color-depth-control` [L48][L11][L65] | 색 영역 맵 + 깊이 맵으로 배치·크기·앞뒤 순서 제어(영역별 프롬프트와 함께) — 3D 마네킹 포징, 영역 레이아웃 | Base (rank 64 / alpha 64, 10,000 step, Krea 2 Turbo 이미지 10,000장), SFT 와 4-step 어댑터로 사용 | `color_end`·`depth_end` 0.5(마네킹 같은 합성 입력, 실사에서 뽑은 맵은 1.0), 영역 프롬프트 필수. ComfyUI 는 0.43.0 이상에서 LoRA 로더 + 네이티브 `MOSS-Image Color/Depth Control` 노드(실험 표시)의 `strength`·`start_percent`·`end_percent` | 0 / ♥51 (집계 안 됨 가능) | 2026-10-19 | Apache-2.0 (비공식, OpenMOSS 아님) | 학습 깊이맵이 Depth Anything V2 Large(CC-BY-NC-4.0)로 만들어졌다(공개 가중치는 어댑터뿐). 전 구간에 걸면 마네킹 질감이 드러나고 손가락·얼굴 정밀도는 거칠다. darask0 4-step 조합은 1024² 약 1.8초(RTX PRO 6000, 참조 구현 Hayate). `Comfy-Org/MOSS-Image` 의 `loras/moss_image_color_depth_control.safetensors`(0.31GB)가 같은 출처다 [L25][L6] |
| `MATLOWAI/MOSS-Image-SFT-DeBand` [L50] | SFT 가 하늘·안개·벽에 그리는 세로 색 줄무늬 제거 — SFT 의 layer 37–41 을 Base 웨이트로 되돌리는 차분(`moss_image_sft_banding_fix_L37-41_bf16`), 넓은 이미지·큰 하늘은 L32–36 을 더한 Quality+ | SFT 레이어 차분 (카드 프리셋은 25 step) | `LoraLoaderModelOnly` strength 1.0, 커스텀 노드 불필요 | 6,495 / ♥16 (병합 int8 `MATLOWAI/MOSS-Image-SFT-DeBand-int8` 8,841 / ♥15) | 2026-10-17 | Apache-2.0 (카드) | 줄무늬 점수 2.04(순정) → 1.39(Quality) / 1.09(Quality+), SFT 유사도(SSIM) 86% / 76% — 많이 지울수록 SFT 고유 그림이 줄어든다. 5 프롬프트·1 시드 시험. 4 step 은 rapid-moss 노드의 'Turbo max' 프리셋(darask0 4-step + 수정, 커스텀 노드 2종)으로만 확인했고 akhaliq 4-step 과는 겹친 검증이 없다 |
| `nynxz/MOSS-Image` — `moss_sft_destripe_top64_bf16.safetensors` [L51] | 같은 줄무늬를 더 약하게 지우는 1.9MB LoRA (DeBand 카드가 "가장 순한 수정"으로 안내) | SFT 전용(Base 에 쓰지 말 것) | `LoraLoaderModelOnly`, strength 768px 1.0 / 1024px 1.5 (1024px 에서 1.0 은 약 절반에 흔적이 남고 1.5 는 12장 중 1장) | HF 5,003 / ♥17 · Civitai `SFT Destripe` (id 3008520) 917 / ♥66 | HF 2026-10-17 · Civitai v1.0 2026-10-18 | Apache-2.0 (카드), Civitai `allowDerivatives`=true | ER-SDE 25 step · CFG 2.5 로 시험했고 4-step 과 겹친 검증은 없다. 같은 리포의 `*_split_qkv` 체크포인트는 Bypass 로더에서만 필요하다 |
| `Danrisi/lenovo_moss` [L52] | 아마추어 스마트폰 스냅 질감 실사(샘플 프롬프트가 그렇다) | Base | 트리거 `l3n0v0`, 스케일·step 미기재 | HF 1,326 / ♥8 · Civitai `Lenovo UltraReal` (MOSS 버전 8,367 / ♥341, 모델 214,215 / ♥5,758) | HF 2026-10-17 · Civitai v1.0 2026-10-17 | Apache-2.0 (HF 카드), Civitai `allowDerivatives`=false | 카드 샘플 프롬프트에 속옷 차림 등 노출 묘사가 있다(성인 전용은 아님). Civitai 갤러리 `nsfwLevel` 31 |
| `Danrisi/nicegirls_v2_moss` [L52] | 인물 사진 질감 실사(카드에 설명 없음, 샘플은 필름·셀피 스타일 인물) | Base | 트리거 미기재(샘플에 `l3n0v0` 가 쓰이기도 함), 스케일·step 미기재 | HF 1,705 / ♥12 · Civitai `NiceGirls UltraReal` (v2 Moss 6,818 / ♥268, 모델 152,928 / ♥4,699) | HF 2026-10-17 · Civitai 2026-10-17 | Apache-2.0 (HF 카드), Civitai `allowDerivatives`=false | 샘플이 인물 위주이고 일부 노출 의상이 있다. Civitai 갤러리 `nsfwLevel` 31 |
| `Danrisi/canon_moss` [L52] | DSLR 사진 질감 실사 | Base | 트리거 `c2n0n`, 스케일·step 미기재 | HF 1,219 / ♥9 · Civitai `Canon UltraReal` (MOSS 버전 2,227 / ♥119, 모델 12,379 / ♥547) | HF 2026-10-17 · Civitai v1.0 2026-10-17 | Apache-2.0 (HF 카드), Civitai `allowDerivatives`=true | 샘플이 인물 위주다. Civitai 갤러리 `nsfwLevel` 31 |
| `axiomofmind/Moss-image-anime-lora` [L53] | 세이넨 애니 스타일 | Base (79장, 2,000 step, rank 16 / alpha 16), 추론은 SFT 권장 | 트리거 `moss_seinen_style`(선택, 쓰면 맨 앞), 50 step · CFG 3, negative 비움, 스케일 권장값 미기재(샘플은 1.0 과 0.7) | 3,953 / ♥17 | 2026-10-20 | Apache-2.0 (카드) | 카드가 "가상의 성인 애니 캐릭터" 생성을 용도로 명시한다. 트리거 없이 `anime character` 로 쓰는 편이 대체로 나았다고 적는다. 해부·손·얼굴·글자 오류 가능 |
| `axiomofmind/Moss-image-beauty-lora` [L53] | 성인 인물·패션·뷰티 사진 | Base (176장, 2,000 step, rank 16 / alpha 16), 추론은 SFT 권장 | 트리거 `moss_beauty_style`, 스케일 1.0, 30 step · CFG 3, negative 비움 | 3,378 / ♥20 | 2026-10-18 | Apache-2.0 (카드) | 학습 데이터가 여성 성인 인물뿐이고 남성은 평가하지 않았다. 아이·단체·전신·풍경·글자·비사진 스타일은 일반화가 약할 수 있다 |
| `axiomofmind/Moss-image-gouache-lora` [L53] | 빈티지 구아슈 일러스트 스타일 | Base (70장, 1,500 step 선택, rank 16 / alpha 16), 추론은 SFT 권장 | 트리거 `moss_vgouache_style`, 스케일 1.0, 30 step · CFG 3, negative 비움 | 1,097 / ♥5 | 2026-10-18 | Apache-2.0 (카드) | 데이터셋이 작다 |
| Civitai `Moss detail tweaker` (id 3007815, lse14) [L4] | 디테일 슬라이더(양수 = 디테일↑, 음수 = ↓) | Base 판 `context detail base v1`, SFT 판 `context detail sft v1` | weight −0.75~0.75 | 모델 3,516 / ♥192 (base 3,017 / ♥186, sft 499 / ♥32) | base 2026-10-18 · sft 2026-10-25 | Civitai `allowCommercialUse`=[RentCivit, Rent, Image] · `allowDerivatives`=true | 작성자가 실험적·불안정이라 표기했고 애니 이미지로 학습해 애니에 더 잘 맞는다. 8-step DMD LoRA 와 함께 쓰면 주제가 조금 바뀔 수 있다 |
| Civitai `[Moss] Realism Enhancer` (id 3023438, alcaitiff) [L4] | 사실감·피부·질감 강화(슬라이더 아님, 2048px 이상 실사 이미지로 학습) | 미기재 | strength 1 에서 시작, Euler / simple 로 시험했고 ER_SDE / Bong_Tangent 가 더 낫다고 작성자가 적는다 | 3,162 / ♥185 | v1.0 2026-10-27 | Civitai `allowCommercialUse`=[Image, RentCivit, Rent, Sell, SellMerge] · `allowDerivatives`=true | 결과는 이미지·설정에 따라 다르다 |
| Civitai `Phone Photography (2000-2025)` (id 2537408, vizsumit) [L4] | 스마트폰 시대별 사진 질감(2000·2007·2020·2025) | 미기재 | 버전별 트리거, 예: 2025 `This is a candid photograph taken with a smartphone of`, 2007 `An amateur low-quality photo with visible noise, soft focus and dull colors.` | 모델 31,931 / ♥908 (MOSS 버전 2025 1,703 / ♥90, 2020 1,227 / ♥77, 2007 1,184 / ♥75, 2000 1,016 / ♥70) | 2000 2026-10-20 · 2007 10-21 · 2020 10-22 · 2025 10-24 | Civitai `allowCommercialUse`=[Image, RentCivit, Rent, Sell, SellMerge] · `allowDerivatives`=true | 설명이 "기본적인 NSFW 표현이 가능"하다고 적는다 |
| Civitai `UltraReal - Moss, Krea2, Klein9b` (id 2462105, vizsumit) [L4] | 매끈한 AI 룩을 줄이고 질감·디테일 추가(인물 근접·중경에 강함) | 미기재 (MOSS_V2 는 SFW 인물 위주 데이터) | 설명에 설정 없음. V2 는 인물에, 아트워크·복잡한 글자에는 약하다고 작성자가 적는다 | 모델 51,755 / ♥1,486 (MOSS_V2 2,712 / ♥119, MOSS_V1 1,512 / ♥87) | MOSS_V2 2026-10-19 · MOSS_V1 2026-10-17 | Civitai `allowCommercialUse`=[Image, RentCivit, Rent, Sell, SellMerge] · `allowDerivatives`=true | 모델 값 51,755 는 Krea 2·Klein 9B 버전까지 합친 값이다 |

**제외한 것**

- `aoleg/MOSS-Sharpness-Slider` (HF 695 / ♥20, 2026-10-26): Base 용 선명도 슬라이더다. 카드가 SFT 에서는 효과가 약하고 SFT + Turbo 에서는 거의 없다고 적어 확정 구성(SFT + 4-step)에 쓸 수 없다. [L54]
- `akhaliq/MOSS-Image-Edit-HQ` (0 / ♥77, 2026-10-22), `chinoll/Moss-Image-Edit` (0 / ♥128, 2026-10-22): MOSS 에 없는 편집을 붙이는 비공식 LoRA 다. Edit-HQ 는 설정이 50 step · CFG 3 이라 4-step 구성과 맞지 않고, chinoll 은 웨이트 라이선스가 비어 있다(코드만 GPLv3). ComfyUI 는 `Text Encode MOSS-Image Edit` 노드로 지원하며 확정 구성의 편집은 나머지 세 모델이 맡는다. [L55][L58][L11]
- `p1atdev/MOSS-Image-SFT-KV-Cache-LoRA` (621 / ♥7, 2026-10-19): lodestones 8-step DMD(0.7)와 전용 노드 `comfy-moss-image-kv-cache` 를 전제로 한 8 step 보정 LoRA 이고, 카드가 다른 DMD 어댑터·강도·step 은 학습 범위 밖이라고 적는다. 2,941 토큰 레이아웃 프롬프트에서 8.03 → 5.26초(RTX 6000 Ada)로 빨라지지만 53 토큰 프롬프트에서는 3.98 → 4.39초로 느려진다. [L56]
- `akhaliq/MOSS-Image-IDM-2-Steps` (0 / ♥39, 2026-10-30): 2 forward 증류다. T2I 는 `runs/idm/export/000750/` 체크포인트를 쓰고 rapid-moss 커스텀 노드와 bf16 SFT 가 필요하며(양자화 베이스는 미검증), 평가는 held-out 8개 프롬프트의 육안 비교 위주라 최종본용으로는 근거가 약하다. [L57]
- `lodestones/MOSS-Image-SFT-8-steps-dmd` (297,914 / ♥230, 2026-10-16)와 `darask0/MOSS-Image_4-step_adapter_lora` (17,614 / ♥43, 2026-10-17): 같은 계열의 다른 가속 어댑터다. lodestones 는 8 step 이고 4-step LoRA 의 웜스타트 부모이며 30일 다운로드는 4-step 의 약 6배다. 카드는 정밀도 때문에 bf16 으로 캐스팅하면 증류 효과 대부분이 사라진다고 적는다. darask0 는 rapid-moss 커스텀 노드 경로다. [L59][L49][L26]
- 성인물 LoRA(`axiomofmind/Moss-image-nsfw-uncensored-lora` 와 복제본 `s2czk/…`·`chfm/…`·`botp/…`, Civitai `Moss Image - Better Nude`·`[Moss] Mystic XXX` 등). [L4][L66]

### 3.4 Fibo 2.0 Edit Turbo

- **호환 주의:** Edit Turbo 로 학습한 LoRA 는 `akhaliq/Fibo-2.0-edit-IDM-2steps` 하나이고 `siraxe/3dhardware_fibo2` 는 카드 메타데이터만 Edit Turbo 를 가리킨다. 나머지는 dev(50 step · guidance 5)로 학습해서 Edit Turbo(4 step · guidance 1)에 얹은 기록이 없다. Bria 카드는 Edit Turbo 를 파인튜닝용으로 권하지 않는다. Civitai 에는 Fibo 용 `baseModel` 값이 없다. 사실상 추천할 LoRA 는 없고 아래는 있는 것의 정리다. [L28][L60][L62][L4]

| LoRA | 용도 | 학습 대상 | 권장값·트리거 | 인기도 | 공개(등록)일 | 라이선스 | 주의 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `akhaliq/Fibo-2.0-edit-IDM-2steps` [L60] | Edit Turbo 4 step → 2 step(IDM 증류, 편집 2 forward, CFG 없음) | Edit Turbo (rank 64 / alpha 64, 550 step, UltraEdit 9,000 트리플릿, 1024², 4×H200) | diffusers `num_inference_steps=2`, `guidance_scale=1.0`. ComfyUI 사용법은 카드에 없다 | 0 / ♥2 (집계 안 됨 가능) | 2026-11-01 | 카드 `license: other` — 기본 모델의 CC BY-NC 4.0 을 따른다고 적는다 | 카드의 평가 표에서 IDM 행이 'computing' 으로 비어 있다(MagicBrush 128행: 교사 4 step L1 0.0479, 순진한 2 step 0.0464). 마스크·멀티레퍼런스 편집은 증류하지 않았고 속성 단위 편집에 유리하고 큰 구조 변환은 어렵다 |
| `siraxe/3dhardware_fibo2` [L62] | 이미지를 3D 하드웨어 렌더로 바꾸는 스타일 편집(위젯 프롬프트 `Change image to 3dhardware render`) | 카드 메타데이터 `base_model` 이 `briaai/Fibo-2.0-edit-turbo` (HF 태그는 `finetune`) | 0.8~1.0 | 0 / ♥0 | 2026-10-26 | 미기재 | 카드가 한 줄뿐이라 학습 정보·평가가 없다 |
| `axiomofmind/Fibo-2.0-anime-lora` [L61] | 세이넨 애니 스타일 | dev | 트리거 `fibo_seinen_style`(구조화 프롬프트 `style_medium` 맨 앞), model 0.7(1.0 은 더 강함) · clip 0.0, 50 step · CFG 5, `Fibo-2.0-Anime-LoRA-ComfyUI.safetensors` | 195 / ♥1 | 2026-10-24 | 카드 `license: other` (`bria-fibo`, CC BY-NC 4.0) | Edit Turbo 에 얹은 검증이 없고 VGL JSON 프롬프트가 전제다 |
| `axiomofmind/Fibo-2.0-psychedelic-lora` [L61] | 사이키델릭 팝 일러스트(네온·굵은 외곽선) | dev | 트리거 `fibo_psychpop_style`, model 0.7 · clip 0.0, 50 step · CFG 5, `…-ComfyUI.safetensors` | 153 / ♥2 | 2026-10-23 | 카드 `license: other` (`bria-fibo`, CC BY-NC 4.0) | 위와 같다 |
| `prithivMLmods/Natural-Exposure-Fibo-2.0-dev` [L63] | 노출 보정 | dev (rank 16, 4,000 step) | 트리거 `transform the image with balanced, natural exposure` | 0 / ♥1 | 2026-10-31 | 카드 `license: other` (`bria-fibo`, CC BY-NC 4.0) | 실험 프리뷰이고 극단 노출·복잡 조명에서 아티팩트가 난다. Edit Turbo 검증 없음 |
| Kijai turbo LoRA — `Comfy-Org/Fibo-2.0` `loras/fibo_2.0_turbo_lora_avg_rank_270_bf16.safetensors` (1.99GB) [L33] | Edit Turbo 의 차분을 dev 에 얹는 가속 | dev 용 | 권장 strength·step 미기재 | 리포 264,445 / ♥224 (파일 단독 수치 없음) | 리포 2026-10-20 | CC BY-NC 4.0 | 용도는 토론 #2 로만 확인된다. Edit Turbo 에는 필요 없다 |

**제외한 것**

- `akhaliq/Fibo-2.0-8step-smd` (0 / ♥1, 2026-10-22): dev T2I 를 8 step · CFG 1 로 줄이는 진행 중인 LoRA(fp32, rank 128)다. 카드는 4 step 이 성립하지 않는다고 적고 ComfyUI 는 fp32 적용 커스텀 노드가 로드맵에만 있다. Edit Turbo 가 이미 4 step 이다. [L64]
- 성인물 LoRA: HF 어댑터 필터로 확인되는 Fibo LoRA(dev 4개, Edit Turbo 1개)에 성인물 태그가 붙은 것은 없다. [L66]

---

## 4. 확인 불가 항목

| 항목 | 상태 |
| --- | --- |
| **H100 에서의 실측** 속도·메모리 | 출처의 속도 수치는 RTX 5090·4070(BFL), A100(4-step LoRA 카드), RTX 5090·PRO 6000(DeBand·color-depth 카드)이고 H100 수치는 없다. 4개 상주 시 활성 메모리도 실측이 없다 [L13][L26][L50][L48] |
| 4-step LoRA 카드의 **속도 수치 불일치** | 같은 카드에 A100 1024² 약 5.6초(4 step)와 약 11초가 함께 있고 측정 조건이 없다 [L26] |
| `qwen3vl_4b_int8_convrot`·`flux2-vae` 를 Klein 패키지가 Fibo·MOSS 와 **같은 파일로 공유**하는지 | Fibo·MOSS 의 `flux2-vae` 는 해시가 같지만 Klein 쪽은 gated 라 해시가 가려져 있고 이름·크기만 같다. 로더 type 이 달라 ComfyUI 가 한 벌만 올리는지도 미확인 [L67][L10] |
| ComfyUI 의 **bf16 가중치 LoRA 패치**(stochastic rounding)가 4-step LoRA 의 미세 글자 품질에 주는 영향 | 코드로는 패치 방식만 확인했다. 카드가 평가한 구성은 diffusers 비병합 fp32 LoRA 이고, 병합이 미세 글자를 먼저 상하게 한다는 경고만 있다 [L10][L26] |
| akhaliq **4-step LoRA 와 스타일·기능 LoRA 의 겹침** | 확인된 조합은 color-depth control + darask0 4-step, DeBand + 낮은 강도 속도 LoRA(10~14 step)뿐이다. DeBand·Destripe·axiomofmind·Danrisi 와 akhaliq 4-step(4 step · strength 1.0)의 조합은 기록이 없다 [L48][L50][L51][L53] |
| color-depth control 의 **영역별 프롬프트**를 ComfyUI 에서 구성하는 방법 | 카드는 영역 프롬프트를 권하지만 참조 구현은 Hayate(Rust/CUDA)이고 ComfyUI 구성은 설명이 없다. 네이티브 제어 노드(실험 표시)만 확인했다 [L48][L11] |
| Klein LoRA 의 **증류판 호환** | Base 로 학습한 LoRA 가 증류판에서 도는지는 Outpaint 만 카드에 문서화돼 있다. MoreReal·360 Degree·Seamfix 는 학습 베이스도 미기재다 [L39][L5][L4] |
| Klein·Qwen 파생 LoRA 의 **라이선스 충돌** | FontBox(카드 Apache-2.0)와 Qwen 쪽 Apache-2.0·MIT 표기 LoRA 가 원본(FLUX Kommunity, Qwen Research)의 조건과 어떻게 얽히는지 명시적 근거가 없다 [L36][L42][L43][L44][L40] |
| Qwen LoRA 의 **Turbo 호환** (Consistency·Restore·Outfit Swap 외) | qma·AnyAngle·WarmBlood·Natural-Exposure 는 원본으로 학습·시험했고 Turbo 검증 기록이 없다 [L42][L43][L44][L45] |
| 오픈웨이트 **Qwen-Image-2.1-Turbo 의 AA 점수** | AA 의 Turbo 항목은 Alibaba Cloud API 모델이고 오픈웨이트로 올라 있지 않다 [L8][L9] |
| AA **Klein 항목의 조건** | BFL API + BFL upsampler(1K)로 만든 결과라 로컬 int8 + `-pup` 구성과 같다는 보장이 없다 [L8][L9] |
| **Fibo 2.0 의 개발사 공지 일자** | HF 등록(dev 10-18, Edit Turbo 10-19), AA `releaseDate`(10-20)가 서로 다르고 Bria 공지는 못 찾았다 [L1][L8] |
| **Fibo Edit Turbo 의 T2I 품질** | 카드는 편집 전용이라고 적고, 이미지 없이 쓰는 T2I 는 커뮤니티 확인뿐이며 dev 와의 정량 비교가 없다 [L28][L31] |
| `e-n-v-y/Qwen-Image-2.1-Fix` 의 **설정·효과** | 카드와 Civitai 설명에 설정·근거가 없다 [L47][L4] |
| `siraxe/3dhardware_fibo2` 의 **학습 정보·라이선스** | 카드가 강도 한 줄뿐이다 [L62] |
| 네 모델의 **한국어 프롬프트·한글 렌더링** | 모델 카드·벤치마크 어디에도 수치가 없다(MOSS 벤치마크는 영·중만) [L12][L16][L21][L28][L23] |
| Civitai **`allowCommercialUse`·`nsfwLevel` 값의 의미** | API 문서에 정의가 없어 값 그대로만 적었다. Qwen·MOSS 목록은 상위 40개까지만 받았다(Klein 은 28개로 전체) [L3][L4] |

---

## 5. 출처 목록

### 측정·공통
- **[L1]** Hugging Face 모델 API — 문서의 모든 HF 수치(`createdAt`·`downloads`·`likes`·`downloadsAllTime`·`tags`·`gated`). 형식 `https://huggingface.co/api/models/{repo}?expand[]=createdAt&expand[]=downloads&expand[]=likes&expand[]=downloadsAllTime&expand[]=tags&expand[]=gated`, 예: <https://huggingface.co/api/models/akhaliq/MOSS-Image-SFT-4-steps?expand[]=createdAt&expand[]=downloads&expand[]=likes&expand[]=downloadsAllTime&expand[]=tags&expand[]=gated>
- **[L2]** Hugging Face Hub 문서 — 모델 다운로드 집계 방식: <https://huggingface.co/docs/hub/models-download-stats>
- **[L3]** Civitai 개발자 문서 — Models 레퍼런스(`baseModels`·`sort`·`nsfw` 파라미터, 응답 필드): <https://developer.civitai.com/site/reference/models>
- **[L4]** Civitai API 질의 (`types=LORA`, `sort=Most Downloaded`, `limit=40`, 기본 응답과 `nsfw=true` 응답을 각각 받음):
  - `baseModels=Flux.3 Klein` — <https://civitai.com/api/v1/models?types=LORA&baseModels=Flux.3%20Klein&sort=Most%20Downloaded&limit=40>
  - `baseModels=Flux.3 Klein-base` — <https://civitai.com/api/v1/models?types=LORA&baseModels=Flux.3%20Klein-base&sort=Most%20Downloaded&limit=40>
  - `baseModels=Qwen 2.1` — <https://civitai.com/api/v1/models?types=LORA&baseModels=Qwen%202.1&sort=Most%20Downloaded&limit=40>
  - `baseModels=MOSS Image` — <https://civitai.com/api/v1/models?types=LORA&baseModels=MOSS%20Image&sort=Most%20Downloaded&limit=40>
  - 베이스 모델 값 목록(Fibo 용 값 없음) — <https://civitai.com/api/v1/enums>
- **[L5]** Civitai `MoreReal`(id 2904424) 모델 상세 — 전체 버전·버전별 통계: <https://civitai.com/api/v1/models/2904424>
- **[L6]** HF 파일 크기(`?blobs=true`): <https://huggingface.co/api/models/black-forest-labs/flux-3-image-klein-comfy?blobs=true> · <https://huggingface.co/api/models/black-forest-labs/flux-3-image-klein-pup?blobs=true> · <https://huggingface.co/api/models/Comfy-Org/Qwen-Image-2.1?blobs=true> · <https://huggingface.co/api/models/Comfy-Org/MOSS-Image?blobs=true> · <https://huggingface.co/api/models/Comfy-Org/Fibo-2.0?blobs=true> · <https://huggingface.co/api/models/akhaliq/MOSS-Image-SFT-4-steps?blobs=true> · <https://huggingface.co/api/models/cyberlangke/moss-image-mini-encoder?blobs=true> · <https://huggingface.co/api/models/madebyollin/texture-fix-vae-for-qwen-image-2.1?blobs=true>
- **[L7]** BFS 의 Qwen 2.1 파일 추가 시점 — 커밋 기록 <https://huggingface.co/api/models/Alissonerdx/BFS-Best-Face-Swap/commits/main> 과 리비전별 파일 목록 `https://huggingface.co/api/models/Alissonerdx/BFS-Best-Face-Swap/tree/{commit}?recursive=true` 비교
- **[L8]** Artificial Analysis — T2I 리더보드(점수·신뢰구간·`releaseDate`·항목 주석): <https://artificialanalysis.ai/image/leaderboard/text-to-image/open-weights>
- **[L9]** Artificial Analysis — 편집 리더보드: <https://artificialanalysis.ai/image/leaderboard/editing/open-weights>
- **[L10]** ComfyUI 소스(master) — `MOSSImage.supported_inference_dtypes`: <https://github.com/Comfy-Org/ComfyUI/blob/master/comfy/supported_models.py> · `unet_dtype`·`should_use_bf16`·`free_memory`: <https://github.com/Comfy-Org/ComfyUI/blob/master/comfy/model_management.py> · 모델 로드 시 dtype 선택: <https://github.com/Comfy-Org/ComfyUI/blob/master/comfy/sd.py> · LoRA 패치의 stochastic rounding: <https://github.com/Comfy-Org/ComfyUI/blob/master/comfy/model_patcher.py> · CLIPLoader type 목록: <https://github.com/Comfy-Org/ComfyUI/blob/master/nodes.py>
- **[L11]** ComfyUI `MOSSImageControl`·`MOSSImageLayoutPrompt`·`TextEncodeMOSSImageEdit` 노드: <https://github.com/Comfy-Org/ComfyUI/blob/master/comfy_extras/nodes_moss_image.py>
- **[L65]** ComfyUI 릴리스 노트 — v0.41.0(FLUX 3 지원 시작), v0.42.0(MOSS-image 지원, PR #17095), v0.43.0(Fibo 2.0 지원 PR #17240, MOSS-image color-depth control 지원): <https://github.com/Comfy-Org/ComfyUI/releases>
- **[L66]** HF 어댑터 목록 API(`filter=base_model:adapter:{repo}`) — 베이스별 LoRA 후보와 성인물 태그 확인. 형식 `https://huggingface.co/api/models?filter=base_model:adapter:{repo}&sort=downloads&direction=-1&limit=100&expand[]=downloads&expand[]=likes&expand[]=createdAt&expand[]=tags`, 예: <https://huggingface.co/api/models?filter=base_model:adapter:OpenMOSS-Team/MOSS-Image-SFT&sort=downloads&direction=-1&limit=100&expand[]=downloads&expand[]=likes&expand[]=createdAt&expand[]=tags> (`{repo}` 는 `black-forest-labs/flux-3-image-klein`·`…-base`, `Qwen/Qwen-Image-2.1`·`…-Turbo`, `OpenMOSS-Team/MOSS-Image-SFT`·`…-Base`, `briaai/Fibo-2.0-dev`·`…-edit-turbo`)
- **[L67]** HF 트리 API — LFS 해시·크기 대조(Klein 쪽은 해시가 가려져 있다): <https://huggingface.co/api/models/black-forest-labs/flux-3-image-klein-comfy/tree/main/text_encoders> · <https://huggingface.co/api/models/Comfy-Org/Fibo-2.0/tree/main/text_encoders> · <https://huggingface.co/api/models/Comfy-Org/Fibo-2.0/tree/main/vae> · <https://huggingface.co/api/models/Comfy-Org/MOSS-Image/tree/main/vae> · <https://huggingface.co/api/models/Comfy-Org/Qwen-Image-2.1/tree/main/text_encoders> · <https://huggingface.co/api/models/Comfy-Org/Qwen3-VL/tree/main/text_encoders>

### FLUX 3 Image Klein
- **[L12]** 모델 카드 `black-forest-labs/flux-3-image-klein`: <https://huggingface.co/black-forest-labs/flux-3-image-klein>
- **[L13]** BFL 블로그 — FLUX 3 Image Klein: <https://bfl.ai/blog/flux-3-image-klein>
- **[L14]** 모델 카드 `black-forest-labs/flux-3-image-klein-pup`: <https://huggingface.co/black-forest-labs/flux-3-image-klein-pup>
- **[L15]** ComfyUI 공식 — FLUX 3 Image Klein 튜토리얼: <https://docs.comfy.org/tutorials/flux/flux-3-klein>

### Qwen-Image-2.1
- **[L16]** 모델 카드 `Qwen/Qwen-Image-2.1-Turbo`: <https://huggingface.co/Qwen/Qwen-Image-2.1-Turbo>
- **[L17]** 모델 카드 `Qwen/Qwen-Image-2.1`: <https://huggingface.co/Qwen/Qwen-Image-2.1>
- **[L18]** `Comfy-Org/Qwen-Image-2.1` 카드·파일 목록: <https://huggingface.co/Comfy-Org/Qwen-Image-2.1>
- **[L19]** ComfyUI 공식 — Qwen-Image-2.1 튜토리얼: <https://docs.comfy.org/tutorials/image/qwen/qwen-image-2-1>
- **[L20]** `madebyollin/texture-fix-vae-for-qwen-image-2.1`: <https://huggingface.co/madebyollin/texture-fix-vae-for-qwen-image-2.1>

### MOSS-Image
- **[L21]** 모델 카드 `OpenMOSS-Team/MOSS-Image-SFT`: <https://huggingface.co/OpenMOSS-Team/MOSS-Image-SFT>
- **[L22]** GitHub `OpenMOSS/MOSS-Image` README·사용자 가이드: <https://github.com/OpenMOSS/MOSS-Image> · <https://github.com/OpenMOSS/MOSS-Image/blob/main/USERGUIDE.md>
- **[L23]** OpenMOSS 공식 블로그(LLTB·RealLayoutArena): <https://openmoss.ai/blog/en/moss-image/>
- **[L24]** ComfyUI 공식 — MOSS-Image 튜토리얼: <https://docs.comfy.org/tutorials/image/moss-image/moss-image>
- **[L25]** `Comfy-Org/MOSS-Image` 카드·파일 목록: <https://huggingface.co/Comfy-Org/MOSS-Image>
- **[L26]** `akhaliq/MOSS-Image-SFT-4-steps`: <https://huggingface.co/akhaliq/MOSS-Image-SFT-4-steps>
- **[L27]** `cyberlangke/moss-image-mini-encoder`: <https://huggingface.co/cyberlangke/moss-image-mini-encoder>

### Fibo 2.0
- **[L28]** 모델 카드 `briaai/Fibo-2.0-edit-turbo`: <https://huggingface.co/briaai/Fibo-2.0-edit-turbo>
- **[L29]** 모델 카드 `briaai/Fibo-2.0-dev`: <https://huggingface.co/briaai/Fibo-2.0-dev>
- **[L30]** `Comfy-Org/Fibo-2.0` 카드·파일 목록: <https://huggingface.co/Comfy-Org/Fibo-2.0>
- **[L31]** `lvladikov/FIBO2-Edit-Turbo-T2I`: <https://huggingface.co/lvladikov/FIBO2-Edit-Turbo-T2I>
- **[L32]** ComfyUI `TextEncodeFibo2` 노드와 편집 템플릿: <https://github.com/Comfy-Org/ComfyUI/blob/master/comfy_extras/nodes_fibo2.py> · <https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_fibo2_edit_turbo_pe.json>
- **[L33]** `Comfy-Org/Fibo-2.0` 토론 #2 "Turbo lora?": <https://huggingface.co/Comfy-Org/Fibo-2.0/discussions/2>

### LoRA 카드 — FLUX 3 Image Klein
- **[L34]** `akhaliq/flux-3-image-klein-angles-lora`: <https://huggingface.co/akhaliq/flux-3-image-klein-angles-lora>
- **[L35]** `Felox/restore_skin`: <https://huggingface.co/Felox/restore_skin>
- **[L36]** `lilylilith/FLUX.3_Klein_FontBox`: <https://huggingface.co/lilylilith/FLUX.3_Klein_FontBox>
- **[L37]** `SimpleTuner/flux-3-klein-image-photo-aesthetics-distilled-assisted-1024-v2-kohaku-fa`: <https://huggingface.co/SimpleTuner/flux-3-klein-image-photo-aesthetics-distilled-assisted-1024-v2-kohaku-fa>
- **[L38]** `NoiseToNova/Flux-3-Klein-turbo-pdd-4_8-steps`: <https://huggingface.co/NoiseToNova/Flux-3-Klein-turbo-pdd-4_8-steps>
- **[L39]** `ausboss/FLUX-3-Image-Klein-Outpaint-LoRA`: <https://huggingface.co/ausboss/FLUX-3-Image-Klein-Outpaint-LoRA>

### LoRA 카드 — Qwen-Image-2.1
- **[L40]** `Alissonerdx/BFS-Best-Face-Swap` 카드와 Qwen 2.1 가이드: <https://huggingface.co/Alissonerdx/BFS-Best-Face-Swap> · <https://huggingface.co/Alissonerdx/BFS-Best-Face-Swap/blob/main/docs/qwen-image-2.1.md> · <https://huggingface.co/Alissonerdx/BFS-Best-Face-Swap/blob/main/docs/qwen-image-2.1-body.md>
- **[L41]** `akhaliq/Qwen-Image-2.1-Turbo-Character-Swap-LoRA`: <https://huggingface.co/akhaliq/Qwen-Image-2.1-Turbo-Character-Swap-LoRA>
- **[L42]** `gribbliest/qwen-image-2.1-qma-camera-angles`: <https://huggingface.co/gribbliest/qwen-image-2.1-qma-camera-angles>
- **[L43]** `lilylilith/QI_2.1_AnyAngle`: <https://huggingface.co/lilylilith/QI_2.1_AnyAngle>
- **[L44]** `WarmBloodAban/Qwen-Image-2.1-LoRAs`: <https://huggingface.co/WarmBloodAban/Qwen-Image-2.1-LoRAs>
- **[L45]** `prithivMLmods/Qwen-Image-2.1-Natural-Exposure-LoRA`: <https://huggingface.co/prithivMLmods/Qwen-Image-2.1-Natural-Exposure-LoRA>
- **[L46]** 가속 LoRA 카드: <https://huggingface.co/PrunaAI/P-Q-Image-2.1> · <https://huggingface.co/lightx2v/Qwen-Image-2.1-Lightning> · <https://huggingface.co/Viggle/Qwen-Image-2.1-viggle-turbo> · <https://huggingface.co/chriswritescode/Turbo8-LoRA-Qwen-Image-2.1>
- **[L47]** `e-n-v-y/Qwen-Image-2.1-Fix`: <https://huggingface.co/e-n-v-y/Qwen-Image-2.1-Fix>

### LoRA 카드 — MOSS-Image
- **[L48]** `darask0/MOSS-Image-color-depth-control`: <https://huggingface.co/darask0/MOSS-Image-color-depth-control>
- **[L49]** `darask0/MOSS-Image_4-step_adapter_lora` (rapid-moss): <https://huggingface.co/darask0/MOSS-Image_4-step_adapter_lora>
- **[L50]** `MATLOWAI/MOSS-Image-SFT-DeBand`: <https://huggingface.co/MATLOWAI/MOSS-Image-SFT-DeBand> · 병합 int8 <https://huggingface.co/MATLOWAI/MOSS-Image-SFT-DeBand-int8>
- **[L51]** `nynxz/MOSS-Image` (SFT Destripe): <https://huggingface.co/nynxz/MOSS-Image>
- **[L52]** Danrisi 카드 3종: <https://huggingface.co/Danrisi/lenovo_moss> · <https://huggingface.co/Danrisi/nicegirls_v2_moss> · <https://huggingface.co/Danrisi/canon_moss>
- **[L53]** axiomofmind 카드 3종: <https://huggingface.co/axiomofmind/Moss-image-anime-lora> · <https://huggingface.co/axiomofmind/Moss-image-beauty-lora> · <https://huggingface.co/axiomofmind/Moss-image-gouache-lora>
- **[L54]** `aoleg/MOSS-Sharpness-Slider`: <https://huggingface.co/aoleg/MOSS-Sharpness-Slider>
- **[L55]** `akhaliq/MOSS-Image-Edit-HQ`: <https://huggingface.co/akhaliq/MOSS-Image-Edit-HQ>
- **[L56]** `p1atdev/MOSS-Image-SFT-KV-Cache-LoRA`: <https://huggingface.co/p1atdev/MOSS-Image-SFT-KV-Cache-LoRA>
- **[L57]** `akhaliq/MOSS-Image-IDM-2-Steps`: <https://huggingface.co/akhaliq/MOSS-Image-IDM-2-Steps>
- **[L58]** `chinoll/Moss-Image-Edit`: <https://huggingface.co/chinoll/Moss-Image-Edit>
- **[L59]** `lodestones/MOSS-Image-SFT-8-steps-dmd`: <https://huggingface.co/lodestones/MOSS-Image-SFT-8-steps-dmd>

### LoRA 카드 — Fibo 2.0
- **[L60]** `akhaliq/Fibo-2.0-edit-IDM-2steps`: <https://huggingface.co/akhaliq/Fibo-2.0-edit-IDM-2steps>
- **[L61]** axiomofmind 카드 2종: <https://huggingface.co/axiomofmind/Fibo-2.0-anime-lora> · <https://huggingface.co/axiomofmind/Fibo-2.0-psychedelic-lora>
- **[L62]** `siraxe/3dhardware_fibo2`: <https://huggingface.co/siraxe/3dhardware_fibo2>
- **[L63]** `prithivMLmods/Natural-Exposure-Fibo-2.0-dev`: <https://huggingface.co/prithivMLmods/Natural-Exposure-Fibo-2.0-dev>
- **[L64]** `akhaliq/Fibo-2.0-8step-smd`: <https://huggingface.co/akhaliq/Fibo-2.0-8step-smd>
