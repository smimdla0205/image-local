# 로컬 이미지 모델 파생판 생태계 (FLUX 3 Klein / Qwen-Image-2.1 / MOSS-Image / Fibo 2.0)

> **범위:** 근본 모델 4개를 **개조한 파생판** — 파인튜닝·증류·LoRA·부품 교체. 근본 모델 자체의 스펙·VRAM·라이선스·ComfyUI 경로는 [`local-image-models-research.md`](./local-image-models-research.md) 에 있고 여기서 반복하지 않는다.
> **판정 기준:** 웨이트의 **값**이 바뀌었으면 개조, 웨이트의 **표현 형식**만 바뀌었으면 양자화 재포장으로 분류한다.
> **다운로드·likes 수치:** Hugging Face 모델 검색 API 기준 [D32]. Civitai 는 `downloadCount` 만 제공한다 [D30].

---

## 목차

1. [핵심 요약](#1-핵심-요약)
2. [Qwen-Image-2.1 파생판](#2-qwen-image-21-파생판)
3. [MOSS-Image 파생판](#3-moss-image-파생판)
4. [FLUX 3 Image Klein 파생판](#4-flux-3-image-klein-파생판)
5. [Fibo 2.0 파생판](#5-fibo-20-파생판)
6. [양자화 재포장 vs 진짜 개조](#6-양자화-재포장-vs-진짜-개조)
7. [조합 레시피](#7-조합-레시피)
8. [확인 불가 항목](#8-확인-불가-항목)
9. [출처 목록](#9-출처-목록)

---

## 1. 핵심 요약

| 계열 | 근본 | 얹을 것 | 한 줄 이유 |
| --- | --- | --- | --- |
| **Qwen-Image-2.1** | `Qwen/Qwen-Image-2.1` | **VAE 교체 필수** + 속도 LoRA 택1 | `madebyollin/texture-fix-vae-for-qwen-image-2.1` 는 체커보드 아티팩트와 fp16 NaN 을 **수치로 증명해서** 고친 유일한 부품 교체다. 속도는 `Viggle` 6-step 또는 `chriswritescode` Turbo8 8-step. [D4][D3][D20] |
| **MOSS-Image** | `OpenMOSS-Team/MOSS-Image-SFT` | **밴딩 수정 + 속도 증류 + (필요시) 편집 LoRA** | 파생판 생태계가 셋 중 가장 활발하다. `MATLOWAI` DeBand 가 SFT 고유 결함(세로 줄무늬)을 고치고, `akhaliq` 4-step 이 50 step 을 4 step 으로 줄이며, `akhaliq/MOSS-Image-Edit-HQ` 가 **공식에 없는 편집 기능을 실제로 추가**한다. 전부 Apache-2.0. [D11][D9][D17] |
| **FLUX 3 Image Klein** | `black-forest-labs/flux-3-image-klein-comfy` | **원칙적으로 아무것도 없다** | HF 상위권은 전부 양자화다. 진짜 개조는 Civitai 에 소수 존재하지만 최상위 LoRA 도 4,633 다운로드 수준이고, 개조 대상이 **이미지 모델이 아니라 prompt upsampler / 텍스트 인코더**에 쏠려 있다. [D30][D31][D14][D25] |
| **Fibo 2.0** | `Comfy-Org/Fibo-2.0` | **없음 — 공식 Edit Turbo 를 T2I 에도 쓴다** | base_model 을 단 HF 리포 41개 중 모델 본체를 다시 학습한 리포는 0개다. 진짜 개조는 LoRA 뿐이고(스타일 2개, 속도 2개 외 소수) Civitai 는 워크플로가 대부분이다. 가장 쓸모 있는 건 웨이트가 아니라 **4-step Edit Turbo 를 이미지 없이 돌리면 T2I 가 된다**는 사용법이다. [D43][D39][D35][D38] |

**한 문장 결론**
- Qwen 은 **부품 하나(VAE)만 바꾸면 되고**,
- MOSS 는 **여러 개를 쌓아야 제값을 하며**,
- FLUX 3 Klein 은 **그냥 공식 파일 그대로 쓰는 게 맞고**,
- Fibo 2.0 은 **개조판보다 공식 Edit Turbo 를 T2I 에도 쓰는 사용법이 먼저다.**

---

## 2. Qwen-Image-2.1 파생판

**근본 한 줄:** `Qwen/Qwen-Image-2.1` 7B single-stream DiT, 생성+편집 통합, 네이티브 RGBA, Qwen Research License(비상업). Turbo 는 공식 8-step 증류판. 상세는 선행 문서 §4.

### 2.1 파생판 표

| 리포 ID | 종류 | 뭘 바꿨나 | dl / likes | 라이선스 영향 |
| --- | --- | --- | --- | --- |
| `madebyollin/texture-fix-vae-for-qwen-image-2.1` | **부품 교체 (VAE 파인튜닝)** | VAE 디코더 재학습 — 체커보드 제거 + fp16 NaN 제거 | 133143 / 210 | Qwen Research (비상업) [D4] |
| `lightx2v/Qwen-Image-2.1-Lightning` | **증류 LoRA** | DMD 4-step, CFG 비활성 | 417109 / 110 | **카드에 라이선스 미기재** [D2] |
| `Viggle/Qwen-Image-2.1-viggle-turbo` | **증류 LoRA (+병합본)** | 40→6 step, CFG 제거, 9-step 하이브리드 모드 | 357150 / 787 | Qwen Research (비상업) [D3] |
| `chriswritescode/Turbo8-LoRA-Qwen-Image-2.1` | **증류 LoRA** | DMD2+GAN 으로 40→8 step | 25317 / 23 | Qwen Research (비상업) [D20] |
| `alibaba-pai/Qwen-Image-2.1-Fun-Controlnet-Union` | **아키텍처 추가 (ControlNet)** | 제어 분기 16 블록 추가 — Canny/Depth/Pose 등 8종 + 인페인팅 | 54787 / 67 | Qwen Research (비상업) [D5] |
| `abenzerps/Qwen-Image-2.1-Uncensored-Quantized` | **양자화 (명칭 불일치)** | 카드 상 `base_model_relation: quantized`. 검열 해제는 동봉된 `qwen-image-2.1-uncensored-lora.safetensors` 로 제공. **LoRA 학습 근거는 카드에 없음** | 2558497 / **5432** | Qwen Research (비상업) [D1] |
| `Noctaluna/Noct-Q-Uncensored-Qwen-Image-2.1` | **파인튜닝/머지 체크포인트** | transformer 웨이트 수정, 사실주의·성인물 방향 | 325494 / 596 | Qwen Research (비상업) [D6] |
| `Noctaluna/Noct-Q-Anime-Uncensored-Qwen-Image-2.1` | **파인튜닝/머지 체크포인트** | 위의 애니메이션 변종 | 41603 / 123 | Qwen Research (비상업) [D21] |
| `pottokao/Qwen-Image-2.1-Text-Encoder-Heretic-GGUF` | **부품 교체 (텍스트 인코더 abliteration)** | Qwen3-VL-8B 인코더의 거부 방향 제거 | 93543 / 367 | **Apache-2.0** (인코더가 Apache 라서) [D7] |
| `AtomicChat/Qwen-Image-2.1-Turbo-Uncensored-GGUF` | 양자화 + (인코더 개조로 추정) | — | 650539 / 691 | 확인 불가 |
| `WarmBloodAban/Qwen-Image-2.1-LoRAs` | **스타일/기능 LoRA 모음** | 애니메 캐릭터 일관성, Anything→실사 변환 | 32730 / 133 | Apache-2.0 [D19] |
| `unsloth/Qwen-Image-2.1-GGUF` / `-FP8` / `Comfy-Org/Qwen-Image-2.1` | **양자화 재포장** | 형식 변환만 | 1717268·690926·10554957 | 원본 그대로 |

### 2.2 Civitai (`baseModel = Qwen 2.1`)

LoRA 상위권 [D30]:

| 이름 | downloadCount | 비고 |
| --- | --- | --- |
| Lenovo UltraReal | 213493 | 다중 베이스 LoRA — Qwen 전용 수치 아님 |
| NiceGirls UltraReal | 152305 | 다중 베이스 |
| Accelerator LoRAs | 24576 | 속도 LoRA 묶음 |
| Qwen Image 2.1 Consistency LoRA | 7358 | Qwen 전용 |
| Qwen 2.1 Turbo LoRas | 6479 | 속도 |
| Qwen Image 2.1 Restore LoRA | 5326 | 복원 |
| Qwen Image 2.1 Outfit Swap Consistency LoRA | 3942 | 편집 보조 |
| Qwen Image 2.1 Outpaint LoRA | 미확인(절단) | 아웃페인팅 |

체크포인트는 `Ray Qwen2.1 편집강화`(5489), `Qwen 2.1 FinalCut`(2616) 등 커뮤니티 머지가 있고, 나머지는 NVFP4·INT4·GGUF 양자화다 [D30].

### 2.3 평가 좋은 것

**`madebyollin/texture-fix-vae-for-qwen-image-2.1` — 이 계열에서 유일하게 "정량 증명된" 개조**

Qwen-Image-2.1 의 순정 VAE 에는 두 가지 결함이 있다. 디테일에 **체커보드 무늬**가 끼고(제작자는 원본 VAE 가 GAN loss 없이 학습된 것으로 추정), fp16 에서 디코더가 **NaN 을 뱉는다**(주로 투명 영역, 주변으로 번짐). 이 리포는 재학습이 아니라 **기존 웨이트 파인튜닝**이다. 고해상도 디코더 2단계 + 출력 헤드를 TAESD 의 adversarial 레시피로 약 5000 step(7.5M 파라미터), 이후 SDXL-VAE-FP16-Fix 방식으로 conv·RMSNorm 의 scale/bias 61k 파라미터를 약 60k step 조정했다. 결과는 **rFID 3.38 → 2.07**(COCO val2017 256²), fp16 활성값 최대치 **약 3.5M → 약 1.3k**(fp16 상한 65504 을 넘지 않음), 185개 스트레스 입력 중 NaN 발생 **75건 → 0건**. 대가는 PSNR 33.29 → 32.73, LPIPS 0.0357 → 0.0384 로 **복원 정확도는 소폭 하락**한다. 지각 품질을 얻고 픽셀 정확도를 내준 교환이다. 쓰는 법은 간단하다 — `texture_fix_vae_for_qwen_image_2.1_bf16.safetensors` 를 `ComfyUI/models/vae/` 에 넣고 `Load VAE` 에서 순정 `qwen_image_2.1_vae_bf16.safetensors` 대신 고르면 끝이고, `--fp16-vae` 도 쓸 수 있다. [D4]

**`Viggle/Qwen-Image-2.1-viggle-turbo` — 속도 LoRA 중 문서화가 가장 정직한 것**

40 step → 6 step, CFG 제거로 end-to-end 약 5배를 주장하는 증류 LoRA다. 중요한 건 **한계를 숨기지 않는다**는 점이다. 카드가 직접 적는 약점: 다중 레퍼런스 합성·얼굴 교체·아이덴티티 보존 편집이 베이스보다 떨어져 유령 형상이나 인물 드리프트가 생기고, **작거나 긴 글자가 베이스보다 자주 깨지며**, 채도가 몇 % 낮다. v0.3 이 v0.2.1 의 엄격한 상위 호환이 아니라는 것도 명시한다(그레인은 줄고 미세 질감은 더 부드러워짐). 정량 근거는 96개 held-out 요청에 대한 LPIPS 표로, GGUF Q8_0 0.051 / int8 convrot 0.057 / Q4_K_M 0.100 — 즉 **병합 단일 파일보다 LoRA 로 얹는 쪽이 원본에 가깝다**. 이걸 반영해 전용 `Viggle Turbo LoRA (unmerged)` 노드를 제공한다(기본 로더는 병합해서 bf16 에서 업데이트의 약 30% 를 잃는다. 대신 step 당 10~25% 느림). 6-step 스케줄은 `Viggle Turbo Sigmas` 노드로 넣고, 베이스 스케줄러의 `shift_terminal: 0.02` 는 마지막 step 을 망가뜨리므로 동봉된 `scheduler/` 설정으로 교체해야 한다. 기본 워크플로 VRAM 피크는 1248×832 에서 약 26GB. [D3]

**`chriswritescode/Turbo8-LoRA-Qwen-Image-2.1` — 수치로 대가를 밝힌 8-step**

같은 속도 목적이지만 접근과 보고 방식이 다르다. 3단계 학습(40-step 교사 렌더 3,100장 기록 → trajectory regression 3,000 step → DMD2 파인튜닝 2,500 step, fake-score critic + GAN head), rank 128. 8 step / CFG 1 / euler / simple. **192개 held-out 프롬프트 오프라인 평가**에서 PickScore 22.15(교사) vs 21.94(Turbo8), CLIPScore 26.89 로 동일, 편집 유사도 DINOv2 0.967, 추출 alpha IoU 0.85. 대신 대가가 명확하다 — **OCR exact-match 95.0% → 75.0%, 문자 정확도 99.6% → 95.3%**. 즉 Qwen 의 간판 기능인 텍스트 렌더링이 깎인다. step 을 늘리거나 CFG 를 1 초과로 올려도 회복되지 않는다고 카드가 적는다. [D20]

**`alibaba-pai/Qwen-Image-2.1-Fun-Controlnet-Union` — 알리바바 PAI 계열의 구조적 확장**

유일하게 **아키텍처를 늘린** 파생판이다. 7.0GB 의 제어 분기(`control_img_in` + `control_blocks` 16개)만 담고 있어 베이스 transformer 가 따로 있어야 하며(`strict=False` 로드), 32개 블록 중 짝수 블록(0,2,…,30)에 zero-init 투영을 통한 skip 연결을 붙인다. 베이스는 동결된다. 입력 129채널 = 제어 latent 64 + 마스크 1 + 마스크 이미지 latent 64. 체크포인트 하나로 **Canny / Depth / Grayscale / HED / Lineart / MLSD / Pose(DWPose) / Scribble 8종 + 인페인팅**을 처리한다. `control_context_scale` 1.0 이 어댑터가 기대하는 최대 강도이고 0.0 이면 제어가 꺼진다. 주의할 점: **사용 경로가 ComfyUI 가 아니다.** 카드는 VideoX-Fun 리포를 클론해 `examples/qwenimage21_fun/predict_t2i_control.py` 또는 `predict_i2i_inpaint.py` 의 상단 설정을 고쳐 돌리는 파이썬 스크립트 방식만 설명한다. config 를 `config/qwenimage21/qwenimage21_control.yaml` 로 맞추지 않으면 웨이트가 조용히 잘못 배치된다. 소비자 GPU 에서는 `model_group_offload` 또는 `model_cpu_offload_and_qfloat8` 가 필요하다. 근거는 8종 제어 각각의 샘플 그리드(40 step, control scale 1.0, seed 43)뿐이고 **정량 지표는 없다**. [D5]

**`abenzerps/Qwen-Image-2.1-Uncensored-Quantized` — likes 1위지만 명칭과 내용이 안 맞는다**

likes 5,432 로 이 계열 전체 1위다. 그런데 모델 카드를 읽으면 **"Uncensored" 를 어떻게 만들었는지에 대한 설명이 없다.** 메타데이터는 `base_model_relation: quantized` 이고 본문도 "원본 upstream 베이스 웨이트를 사용"한다고 적으며, 바꾼 것은 GGUF / FP8 / INT8 ConvRot / NVFP4 / MLX 형식 변환뿐이라고 기술한다. 파인튜닝·LoRA 병합·abliteration 언급이 없다. 카드가 "Uncensored" 와 관련해 적는 것은 **"내장 세이프티 체커나 콘텐츠 필터가 없다"**는 사실 진술 하나다 — 이는 Qwen-Image-2.1 원본에도 해당하는 특성이다. 다만 리포 파일 목록에는 본문이 언급하지 않는 **`qwen-image-2.1-uncensored-lora.safetensors` 가 같이 들어 있다** — 즉 체크포인트 자체는 양자화판이고, 검열 해제는 **별도 LoRA 파일로 동봉**하는 구조다. 그 LoRA 의 학습 방법과 근거는 여전히 카드에 없다. 따라서 **체크포인트만 보면 양자화 재포장이고, 개조는 동봉된 LoRA 쪽에 있다.** 실용적으로는 잘 정리된 양자화 모음이다(Q4_K_M 권장, INT8 ConvRot 6.76GB, NVFP4 4.20GB, Apple Silicon 용 MLX 4/6/8bit 포함). `leejet/ComfyUI-GGUF` 포크가 필요하고 구 city96 설치에서는 "Unknown model architecture!" 가 난다. [D1]

**`pottokao/Qwen-Image-2.1-Text-Encoder-Heretic-GGUF` — 이미지 모델이 아니라 인코더를 고친 사례**

DiT 는 건드리지 않고 **텍스트 인코더(Qwen3-VL-8B-Instruct)만** Heretic(p-e-w) 도구로 directional ablation 했다. 대상은 `o_proj` 와 `down_proj`, 200 trial(startup 60)의 Pareto front knee point 선택. 측정값은 거부율 100/100 → 5/100, 순정 대비 KL divergence 0.0220, bf16 재검증에서 0/20 거부 + benign 4/4 정답. 라이선스가 중요한 포인트다 — **Qwen3-VL-8B 가 Apache-2.0 이라 이 파생물도 Apache-2.0 으로 배포된다.** 반면 같이 쓰는 DiT 는 Qwen Research License 이므로, 인코더만 자유 라이선스가 되고 파이프라인 전체는 여전히 비상업이다. GGUF 사용에는 **pottokao 패치 노드가 추가로 필요**하고(mmproj 파일을 같은 폴더에 두고 이름을 바꾸지 않음, `CLIPLoaderGGUF` type `qwen_image`, 콘솔에 vision tensor 351개 추가 로그 확인), FP8/bf16 은 순정 `CLIPLoader` 로 바로 된다. ComfyUI 0.36.0 이상. 이 패치 노드는 일부 Qwen-Image-2.1 DiT GGUF 의 "Unknown model architecture" 도 같이 해결한다. [D7]

---

## 3. MOSS-Image 파생판

**근본 한 줄:** `OpenMOSS-Team/MOSS-Image-SFT` 5B single-stream DiT, **Apache-2.0**, 기본 50 step / CFG 3 / shift 5, **T2I 전용**. 상세는 선행 문서 §5.

> MOSS 는 세 계열 중 파생판 생태계가 가장 활발하다. 이유는 둘이다 — **Apache-2.0 이라 파생물 라이선스가 꼬이지 않고**, 공식이 느리고(50 step) 결함(밴딩)이 있으며 **편집이 아예 없어서** 고칠 거리가 많다.

### 3.1 파생판 표

| 리포 ID | 종류 | 뭘 바꿨나 | dl / likes | 라이선스 영향 |
| --- | --- | --- | --- | --- |
| `lodestones/MOSS-Image-SFT-8-steps-dmd` | **증류 LoRA + fp32 체크포인트** | data-space DMD, 50 step CFG 3 → **8 step CFG 없음** | 292392 / 230 | Apache-2.0 [D8] |
| `akhaliq/MOSS-Image-SFT-4-steps` | **증류 LoRA** | lodestones 웜스타트 → **4 step**, v2.0 부터 순정 Euler 샘플러 | 46438 / 77 | Apache-2.0 [D9] |
| `darask0/MOSS-Image_4-step_adapter_lora` (rapid-moss) | **증류 LoRA** | data-space DMD + DMAD critic, 4 step | 16927 / 43 | Apache-2.0 [D18] |
| `congruency/MOSS-Image-Turbo-MFD` | **증류 LoRA** | Mean Flow Distillation, 4~8 step | 1263 / 3 | Apache-2.0 [D23] |
| `MATLOWAI/MOSS-Image-SFT-DeBand` | **부품 교체 (레이어 되돌리기 LoRA)** | SFT 의 layer 37–41(+32–36)을 **Base 웨이트로 복원**해 세로 줄무늬 제거 | 6284 / 16 | Apache-2.0 [D11] |
| `MATLOWAI/MOSS-Image-SFT-DeBand-int8` | **병합 체크포인트** | 위 수정을 int8 단일 파일로 병합(+DMD 0.35 변종) | 8699 / 14 | Apache-2.0 [D24] |
| `chinoll/Moss-Image-Edit` | **편집 LoRA** | 공식에 없는 **지시 기반 편집** 추가 (ConceptEdit-12M 사용 언급) | 미조회 | **웨이트 라이선스 미기재** (코드는 GPLv3) [D13] |
| `akhaliq/MOSS-Image-Edit-HQ` | **편집 LoRA** | chinoll 에서 웜스타트해 ai-toolkit 으로 재학습(v5 권장) | **0 / 76** | Apache-2.0 [D17] |
| `axiomofmind/Moss-image-nsfw-uncensored-lora` | **스타일 LoRA** | 성인 인물 사진 방향, rank 16, 130장 1,750 step | 44975 / **495** | Apache-2.0 [D10] |
| `axiomofmind/Moss-image-anime-lora` | **스타일 LoRA** | 세이넨 애니메 방향, rank 16, 79장 2,000 step | 3307 / 16 | Apache-2.0 [D12] |
| `axiomofmind/Moss-image-beauty-lora` | **스타일 LoRA** | 뷰티/포트레이트 방향, rank 16, 176장 2,000 step | 3182 / 18 | Apache-2.0 [D29] |
| `Langzaigg/moss-image-anime-turbo` | **병합 체크포인트** | turbo 파생 + NSFW LoRA 0.7 을 백본에 병합, 인코더·VAE 동봉 | 4855 / 4 | Apache-2.0 [D22] |
| `toxicdog/MOSS-Image-SFT-Turbo-INT8-ConvRot` | 양자화 + (8-step 요소 내장) | INT8 ConvRot, 8 step 권장. **8-step 을 어떻게 얻었는지 카드가 설명하지 않음** | 40023 / 11 | Apache-2.0 [D26] |
| `unsloth/MOSS-Image-SFT-GGUF` / `Comfy-Org/MOSS-Image` | **양자화 재포장** | 형식 변환만 | 56842 · 3959924 | 원본 그대로 |

### 3.2 Civitai (`baseModel = MOSS Image`)

| 이름 | 종류 | downloadCount |
| --- | --- | --- |
| UltraReal - Moss, Krea2, Klein9b | LORA (다중 베이스) | 51543 |
| Phone Photography (2000-2025) | LORA (다중 베이스) | 31675 |
| MOSS Image | Checkpoint (SFT 재배포) | 20987 |
| Moss Image Turbo LoRas | LORA | 18246 |
| Moody Moss Mix | Checkpoint | 9593 |
| Realism By Stable Yogi Moss | Checkpoint | 9279 |
| Dirty-Moss | Checkpoint | 5588 |
| Moss detail tweaker | LORA | 3343 |
| Breast Size Slider (MOSS) | LORA | 3131 |
| [Moss] Realism Enhancer | LORA | 2797 |
| MOSS-Image 2.5D Anime | Checkpoint | 2262 |

[D30]

### 3.3 평가 좋은 것

**`MATLOWAI/MOSS-Image-SFT-DeBand` — 가장 영리한 "개조"**

MOSS-Image-SFT 는 하늘·안개·배경·벽 같은 매끄러운 영역에 **일정 간격의 세로 색 줄무늬**를 그린다. 1536px 이상 넓은 이미지에서는 더 넓고 물결치는 줄무늬가 된다. 이 리포가 한 일은 파인튜닝도, VAE 교체도, 디코더 수정도 아니다 — **SFT 의 일부 레이어를 Base 모델 웨이트로 되돌리는 정확한 차분을 LoRA 형태로 만든 것**이다. 메인 수정은 layer 37–41(40 텐서, bf16, full rank), 추가 수정은 layer 32–36 이며 나머지 레이어는 건드리지 않는다. 찾는 과정도 공개한다: 블록 범위별 Base↔SFT 교체 → residual stream 을 탐침해 줄무늬 에너지가 레이어·step 별로 어디서 쌓이는지 확인 → 후보 범위 bakeoff. Kijai 가 "SFT 의 후반 블록이 밴딩을 만든다"고 관찰한 것을 출발점으로 삼았다고 명시한다.

대가가 수치로 나와 있다 — **밴딩 점수(1.0 ≈ 깨끗, 순정 SFT 평균 2.04) 대 SFT 유사도(SSIM)**의 교환이다. Quality(메인만)는 밴딩 1.39 / 유사도 약 86%, Quality+(메인+추가)는 밴딩 **1.09** / 유사도 약 76%, Turbo 프리셋은 유사도 약 45% 까지 떨어진다. 즉 **줄무늬를 많이 지울수록 SFT 고유의 그림이 사라지고 Base 쪽으로 돌아간다.** 넓은 이미지나 큰 하늘에는 Quality+ 를, 그 외에는 메인만 권한다. 쓰는 법은 커스텀 노드 없이 `moss_image_sft_banding_fix_L37-41_bf16.safetensors` 를 `ComfyUI/models/loras/` 에 넣고 SFT 모델 뒤에 `LoraLoaderModelOnly` 를 strength 1.0 으로 다는 게 전부다. 한계도 적어뒀다 — 테스트셋이 작고(프리셋 5 프롬프트·1 시드), 밴딩 점수가 미세 그레인이나 실제 세로 패턴에 반응해 올라갈 수 있으며, ComfyUI 에서만 검증했다. [D11]

**`akhaliq/MOSS-Image-SFT-4-steps` — 50 step → 4 step, 그리고 텍스트를 지킨 증류**

lodestones 의 8-step DMD 를 웜스타트로 삼아 더 줄였다. v1.x 는 data-space DMD, **v2.0 부터 Euler-native** 로 바뀌어서 `lora.safetensors` 하나만 순정 샘플러(ComfyUI: euler / simple)에 얹으면 돌아간다 — 커스텀 data-space 샘플러와 `time_embedding.safetensors`·`dataspace.safetensors` 가 사라졌다. 이게 실사용에서 큰 차이다. 교사는 bf16 SFT, CFG 3.0 동결. 4 step / CFG 1.0 / negative 없음.

근거는 저자 자체 비교지만 구체적이다 — v1.1, darask0 의 rapid-moss, lodestones 8-step 과 **동일 프롬프트·시드**로 비교해 "62% / 38%" 같은 **숫자 텍스트를 이것만 정확히 렌더**한다고 보고한다. MOSS 의 간판 기능이 장문 텍스트라는 점에서 의미 있는 비교축이다. 제약이 많으니 그대로 지켜야 한다: MOSS 기본값(25~50 step, CFG 2.5~3)을 쓰면 **뭉개진 결과**가 나오고, LoRA 를 bf16 웨이트에 **병합하면 미세 텍스트가 상한다**(fp32 unmerged 유지 또는 동봉된 fp32 병합 파일 사용). 1024² 이하는 4 step, 약 1536px 는 6 step, 2048² 는 8 step 이 필요하고 1024² 초과에서 4 step 은 뿌옇다(학습이 1024² 데이터만 썼기 때문). 3-step 드래프트 LoRA 는 4-step 대비 약 25% 빠르고(A100 1024² 기준 약 4.2s vs 5.6s), 2-step 시도는 베이스라인을 못 이겨 기록용으로만 남겼다고 적는다. [D9]

**`lodestones/MOSS-Image-SFT-8-steps-dmd` — 이 계열 증류의 뿌리**

MOSS 증류 LoRA 들의 공통 조상이다(akhaliq 4-step, darask0 rapid-moss 모두 여기서 웜스타트). data-space DMD(arXiv 2610.12102)로 50 step CFG 3 을 **8회 네트워크 평가, CFG 없음**으로 줄였다. ComfyUI 에서는 `lora.safetensors` strength 1.0 또는 `lora_latest.safetensors` **strength 0.7(권장)**. 핵심 주의사항이 하나 있는데 중요하다 — **증류 델타가 bf16 의 반올림 간격보다 작아서, transformer 를 bf16 으로 캐스팅하면 증류 효과 대부분이 사라진다.** 그래서 full 체크포인트는 fp32 가 강제되고, bf16 추론을 하려면 베이스 bf16 에 어댑터를 **병합하지 않고** 얹되 `time_embedding.safetensors` 를 fp32 로 유지해야 한다. 학습 데이터가 compact-JSON `scene_graph` 캡션이라 **그 형식 프롬프트에서 가장 잘 맞는다**고 적는다. 정량 지표·교사 대비 비교는 없고, 본인도 work-in-progress 로 표현한다. 카드의 usage 절이 `[Deprecated] ignore this section` 으로 표시돼 있는데 **fp32·unmerged 워크플로의 유일한 상세 설명이 거기 있다**는 모순이 있다. [D8]

**`akhaliq/MOSS-Image-Edit-HQ` — MOSS 에 없는 편집을 실제로 붙인다**

> 사용자 질문: "MOSS 는 공식이 T2I 전용인데 편집 포크가 실제로 되는가" → **된다. 단 비공식 LoRA 이고, 아키텍처 변경이 아니라 어댑터 학습이다.**

계보가 둘이다. 먼저 `chinoll/Moss-Image-Edit` 가 지시 기반 편집(색·의상·조명·계절·스타일) LoRA 를 내놓았다. ComfyUI 워크플로(`moss_edit_single_reference.json`, `moss_edit_multi_reference.json`)로 최대 4장 레퍼런스를 연결한다고 적고, ConceptEdit-12M 을 단일 이미지 편집에 썼다고 크레딧에 밝힌다. 다만 **학습 방법·rank·하이퍼파라미터를 전혀 적지 않고, 아키텍처를 레퍼런스 입력용으로 바꿨는지도 설명하지 않으며, 성공률·실패 사례·벤치마크가 없고, 웨이트 라이선스 필드가 비어 있다**(코드만 GPLv3). 그래서 품질이 검증되지 않았다.

`akhaliq/MOSS-Image-Edit-HQ` 는 그 chinoll LoRA 에서 **웜스타트해 이기는 것을 목표로** 한 재학습판이다(split q/k/v 키를 ai-toolkit 의 fused 형식 rank 192 로 변환). ostris/ai-toolkit 으로 학습했고 후기 버전은 ConceptEdit-12M 부분집합 + 제거/얼굴/환경 데이터 + 편집 영역 마스크 + masked loss + 전체 장면 캡션을 썼다. v5 는 1,200 step, lr 1e-5. 실패한 실험도 공개한다 — **v6 은 v5 를 못 이겼고, v1 은 chinoll 상대 eval gate 에서 졌다.** 쓰는 법: ComfyUI v0.42.1 초과 빌드에서 `armV5.safetensors` 를 `models/loras/` 에 넣고 **Text Encode MOSS-Image Edit 노드의 `edit_format` 을 `ai-toolkit`** 으로 둔다(Chenkin-x 플러그인 경로는 `armV5-moss-edit-lora.safetensors` 를 `models/model_patches/` 에). 설정은 flow-matching Euler, shift 5.0, **50 step, CFG 3.0**, bf16 기준 약 20GB+ VRAM. 알려진 약점은 **다중 레퍼런스 합성이 약하다**는 것(v4 가 단일 레퍼런스 쌍으로 학습됨)과 MOSS-Image-Base 미검증. 8-step DMD LoRA 를 겹치면 드래프트는 빨라지지만 50-step 대비 결과가 부드러워진다고 적는다. 정량 지표는 없고 "직접 보고 판단하라"는 입장이다. [D17][D13]

**`axiomofmind` 3종 LoRA — Apache-2.0 생태계의 전형**

`nsfw-uncensored`(likes 495 로 MOSS 계열 서드파티 1위), `anime`, `beauty` 가 같은 레시피로 만들어졌다 — **rank 16 / alpha 16**, 어텐션 q/k/v/o + FFN up/down 투영 대상, AdamW lr 1e-4, constant+warmup, batch 1, 해상도 1024, seed 42, 수평 반전 없음, caption dropout 0. 데이터셋 규모는 각각 130장·79장·176장으로 **작다**. 학습은 `MOSS-Image-Base` 에 했지만 **추론은 `MOSS-Image-SFT` 를 권장**한다(저자 로컬 평가 기준). 권장값은 LoRA scale 0.7~1.0, 30~50 step, **CFG 3.0**, negative 비움. 트리거는 각각 `moss_xvstyle` / `moss_seinen_style` / `moss_beauty_style` 를 프롬프트 맨 앞에 둔다 — 다만 anime 쪽은 최종 비교에서 **트리거 없이 "anime character" 로 자연스럽게 쓰는 편이 대체로 나았다**고 솔직히 적는다.

ComfyUI 사용 시 함정이 하나 있다. **루트의 PEFT 파일(`pytorch_lora_weights.safetensors`)이 아니라 `*-ComfyUI.safetensors` 를 써야 한다** — 키 이름이 달라 루트 파일은 "lora key not loaded" 가 난다(변환 스크립트가 `transformer.` 를 `diffusion_model.` 로 바꾸는 것뿐이고 텐서 값·shape·rank·alpha 는 동일). 네이티브 MOSS-Image 로더 지원이 있는 빌드(커밋 `b1a247c` 이상)가 필요하고, LoRA 로더의 **CLIP strength 는 0.0** 으로 둔다. 근거는 순정 SFT 와의 고정 시드 side-by-side 그리드뿐이고 정량 지표는 없다. 저자들 스스로 해부학·손·얼굴·글자·기계물 오류가 나올 수 있다고 한계를 적는다. 전부 Apache-2.0 이고 OpenMOSS 공식이 아니다. [D10][D12][D29]

---

## 4. FLUX 3 Image Klein 파생판

**근본 한 줄:** `black-forest-labs/flux-3-image-klein-comfy` 5.6B, gated, FLUX Kommunity License v1.0(**파생물도 같은 라이선스로 공유**), ComfyUI 0.41.0+ 네이티브. 상세는 선행 문서 §3.

### 4.1 Hugging Face — 양자화 외에는 "모델 본체" 개조가 없다

HF 상위 16개 리포를 분류하면:

| 리포 ID | 종류 | 뭘 바꿨나 | dl / likes | 라이선스 영향 |
| --- | --- | --- | --- | --- |
| `black-forest-labs/flux-3-image-klein-comfy` · `-base` · `-pup` | 공식 | — | 925236 / 149203 / 117787 / 61268 | FLUX Kommunity |
| `ml-resources/flux-3-image-klein-comfy` | **ungated 미러 + 재패키징** | 웨이트 값 동일(BF16 transformer·ae 가 원본과 일치), int8·NVFP4·w4a8 변종 포함. **퍼블리셔 미기재** | 381744 / 10 | FLUX Kommunity [D28] |
| `AtomicChat/FLUX-3-Image-Klein-pup-Uncensored-GGUF` | **부품 개조 (upsampler abliteration)** | **9B prompt upsampler** 의 거부 방향 rank-1 제거 + GGUF | 14712 / 15 | Apache-2.0 (upsampler 가 Apache) [D14] |
| `AtomicChat/FLUX-3-Image-Klein-TE-Uncensored-GGUF` | **부품 개조 (텍스트 인코더 abliteration)** | **Qwen3-VL-4B 인코더**의 거부 방향 제거 | 11819 / 9 | Apache-2.0 [D25] |
| `prithivMLmods/...-prompt-upsampler-abliterated-GGUF` | **부품 개조 (upsampler abliteration)** | weight orthogonalization 으로 safety alignment 제거 | 3173 / 3 | Apache-2.0 [D16] |
| `webmp3/Sakura-FLUX.3-Image-Klein-GGUF` | **양자화 재포장** | DiT GGUF 변환 + importance matrix 캘리브레이션. **파인튜닝 아님** | 6211 / 6 | FLUX Kommunity(+인코더 Apache) [D15] |
| `toxicdog/FLUX.3-Image-Klein-INT4-ConvRot-ComfyUI` | **양자화 + 구조 변경(재학습 아님)** | INT4 ConvRot W4A4 + q/k/v 를 `qkv` 로 융합 | 1394 / 8 | FLUX Kommunity [D27] |
| `unsloth/...-GGUF` · `-FP8`, `leejet/...-GGUF`, `realrebelai/...`, `AtomicChat/...-GGUF`, `Abiray/...-sd-GGUF` | **양자화 재포장** | 형식 변환만 | 153166 · 150916 · 50310 · 38402 · 23064 · 14471 | 원본 그대로 |

**즉 HF 에서 FLUX 3 Klein 의 "개조"는 전부 이미지 모델 바깥에서 일어난다** — upsampler 와 텍스트 인코더. 이유는 구조적이다. 두 부품은 Qwen3.5-9B / Qwen3-VL-4B 기반이라 **Apache-2.0** 이고 LLM abliteration 도구가 이미 성숙해 있는 반면, 5.6B DiT 본체는 gated + FLUX Kommunity License(파생물도 같은 라이선스 강제) 아래 있고 파인튜닝은 `-base` 로 해야 한다.

### 4.2 Civitai — 진짜 LoRA 는 여기 있다. 다만 소수다

> **사용자 핵심 질문의 답: "HF 에는 양자화밖에 없다"는 관찰은 맞다. 하지만 Civitai 에는 `Flux.3 Klein` 베이스모델 태그가 실제로 존재하고 LoRA 도 있다. 다만 규모가 Qwen·MOSS 보다 뚜렷하게 작다.**

Civitai API `baseModels=Flux.3 Klein` 결과 [D30]:

**체크포인트는 3개뿐이고, 2개는 양자화다.**

| 이름 | downloadCount | 실체 |
| --- | --- | --- |
| Flux.3 Klein | 4386 | 공식 웨이트 재배포 |
| Flux 3 Klein INT8/INT6/INT4 | 1222 | 양자화 |
| Flux3 Klein GGUF | 379 | 양자화 |

→ **Civitai 에도 FLUX 3 Klein 파인튜닝 체크포인트는 없다.** (대조: `MOSS Image` 는 Moody Moss Mix 9593, Realism By Stable Yogi 9279, Dirty-Moss 5588 등 커뮤니티 머지가 여럿, `Qwen 2.1` 은 Ray Qwen2.1 편집강화 5489, FinalCut 2616 등.)

**LoRA 는 존재한다.**

| 이름 | downloadCount | Klein 전용 여부 |
| --- | --- | --- |
| 80s Fantasy Movie | 44597 | 다중 베이스 — Klein 전용 수치 아님 |
| Dark Ghibli Fairytales | 25703 | 다중 베이스 |
| 360 Degree [Flux] | 14667 | 다중 베이스 |
| Octane Render | 14217 | 다중 베이스 |
| **MoreReal** | **4633** | Flux.3 Klein 버전 존재(`F3K`) |
| VALEJO | 4280 | 다중 베이스 |
| 炭笔素描 Charcoal sketch | 1276 | 다중 베이스 |
| **FLUX 3 Image Klein Outpaint LoRA** | **964** | Klein 전용 |
| 360 Flux 2/3 Klein Seamfix | 629 | Flux 2/3 Klein |
| **B!G BODY – Figure Enhancer \| FLUX 3 Klein v1** | **429** | Klein 전용 |
| [Flux3 Klein] Asian Mix Lora | 297 | Klein 전용 |
| NexBlend 01 Asian Realistic LoRA - Flux 3 Klein | 250 | Klein 전용 |
| Flux3Klein Big Breasts Text2Image | 214 | Klein 전용 |

**숫자 읽는 법이 중요하다.** 상위권의 큰 수치(44597, 25703, 14667, 14217)는 **여러 베이스 모델용 버전을 한 모델 페이지에 묶은 LoRA**의 누적 다운로드다. `baseModels` 필터에 걸렸다는 건 "Flux.3 Klein 버전이 하나라도 있다"는 뜻이지 Klein 전용 수요가 아니다. **Klein 을 위해 만들어진 LoRA 중 최상위는 `MoreReal`(4633)** 이고, 그다음부터는 1,000 미만으로 급락한다.

워크플로 항목(`FLUX 3 Image Klein Multi-Image Edit` 1468, `Upscale | SeedVR2 + Restore LoRA` 851, `Edit` 850, `Outpaint | Extend or Rotate` 660)이 LoRA 못지않게 많다는 점도 이 생태계의 성격을 보여준다 — **모델을 고치기보다 공식 모델을 어떻게 연결할지**에 커뮤니티 노력이 쏠려 있다.

### 4.3 평가 좋은 것

**`MoreReal` (Civitai 2904424, 제작자 NO8D) — FLUX 3 Klein 용 최상위 LoRA**

"어떤 이미지든 사실적 사진으로 변환(A2R)"하는 LoRA다. Flux.3 Klein 버전명은 `F3K`, downloadCount 4,633 / thumbsUp 337. 제작자는 다른 A2R 모델보다 **머리카락·피부 질감·배경 처리가 낫다**고 주장한다. 권장 weight 0.6~0.9, step 수는 미지정. 트리거는 베이스별로 다른데 **MOSS-Image 와 FLUX3-Klein 은 "Convert this image into a photograph", Qwen-Image-2.1 과 Krea2Edit 는 "photorealistic"** 이다 — 즉 이것도 Klein 전용이 아니라 다중 베이스 LoRA 중 Klein 버전이 있는 경우다. 유료(Patreon) 비공개 버전이 따로 있다. 정량 근거는 없다. [D31]

**`AtomicChat/FLUX-3-Image-Klein-pup-Uncensored-GGUF` — 측정값을 다 공개한 abliteration**

FLUX 3 Klein 모델 카드는 **"prompt upsampler 없이 쓰지 말라"**고 명시한다(선행 문서 §3.2). 그래서 9B upsampler 가 요청을 거부하거나 완곡하게 바꾸면 **이미지 모델에 도달하기 전에 프롬프트가 변형된다.** 이 리포는 그 지점을 고친다. 방법은 rank-1 weight edit — 32개 블록 전부의 어텐션 출력과 MLP down-projection 에 `W' = W − 0.75·r·rᵀW` 를 적용하고, 방향 `r` 은 block 19/32 의 마지막 프롬프트 토큰 residual 평균(유해 − 무해)에서 추정했다(Arditi et al. 2024 근거). 토큰 임베딩·출력 헤드·MTP 레이어·비전 타워는 건드리지 않았다. 재학습이 아니다.

측정값을 전부 적어둔 게 이 카드의 장점이다 — held-out 영어 유해 프롬프트 81개 거부율 **63% → 0%**, XSTest 안전 프롬프트 거부 3.2% → 0%, **MMLU 74.15% → 73.95%**(능력 손실 거의 없음), tool call·needle-in-a-haystack 불변. 양자화별 BF16 대비 KLD 0.0015(BF16)~0.0491(IQ3_S). 더 중요한 건 **"그래서 이미지가 달라지는가"** 에 대한 답이다 — 민감 캡션 요청 45개 중 순정이 35개 중 31개를 유지, 이것이 33개 유지(LLM 판정). 실제 렌더 결과는 **90장 중 79장(이것) vs 80장(순정)** 으로 사실상 차이가 없었고, 카드는 **"추가로 통과한 2건을 이미지 모델이 어느 빌드에서도 그리지 않는다"**고 적는다. 즉 **upsampler 를 풀어도 이미지 모델 자체의 성향은 그대로**라는 것을, 만든 쪽이 직접 보고한 셈이다. 권장 파일은 `FLUX-3-Image-Klein-pup-Uncensored-AD-IQ4_XS.gguf`(5.51GB), 고충실도는 `Q8_0`(9.53GB), 3MB LoRA 형태(`--lora-scaled ... 0.75`)도 제공한다. **한계: 사용법이 `llama-server` 기준이고 ComfyUI 경로를 카드가 설명하지 않는다.** 동일 제작자의 `TE-Uncensored`(텍스트 인코더 쪽)는 **ComfyUI 가 Qwen3-4B 로 잘못 읽어 Klein 샘플러가 실패**하므로 stable-diffusion.cpp 를 써야 한다고 명시한다. [D14][D25]

`prithivMLmods/...-abliterated-GGUF` 는 같은 부품(upsampler)에 대한 다른 abliteration 이지만 **도구·파라미터·캘리브레이션 데이터를 밝히지 않고 벤치마크도 없다.** 출력은 영어 전용, 레퍼런스 이미지는 1MP 로 다운스케일된다고 적는다. 모드별 시스템 프롬프트(t2i / i2i / t2i_bbox / i2i_bbox)는 BFL 의 `system_prompts.json` 을 쓴다. [D16]

**`webmp3/Sakura-FLUX.3-Image-Klein-GGUF` — 이름이 오해를 부르지만 개조가 아니다**

"Sakura" 라는 이름과 애니메 샘플 때문에 애니메 파인튜닝으로 오인하기 쉽다. **아니다.** 카드가 `base_model_relation: quantized` 로 선언하고, 바꾼 내용은 `sd-cli -M convert`(stable-diffusion.cpp 커밋 `8cd731e`)로 원본 `model.safetensors` 를 GGUF 로 변환해 Q8_0/Q6_K/Q5_K/Q4_K 로 양자화하고 ComfyUI-GGUF 용 `general.architecture = flux` 메타데이터를 추가한 것뿐이다. 텍스트 인코더는 **공식 Qwen3-VL-4B-Instruct 를 "unmodified"** 로 명시하고 VAE 도 공식 `ae.safetensors` 사본이다. importance matrix 는 중립 프롬프트 6개로 수집한 **캘리브레이션이지 학습이 아니다**.

그래도 품질 기록은 쓸 만하다 — BF16 대비 PSNR 이 Q8_0 평균 35.1dB(최저 22.8), **Q4_K_M 평균 22.7dB(최저 14.2)** 로 저비트에서 편차가 크다. 본인도 "6개 프롬프트는 벤치마크가 아니다"라고 적는다. 속도 측정이 흥미로운데 **ComfyUI 에서 GGUF 가 BF16 보다 빠르지 않았다**(40.2s vs 36.2s). 즉 **FLUX 3 Klein GGUF 는 속도가 아니라 VRAM 을 위한 선택**이다. [D15]

---

## 5. Fibo 2.0 파생판

**근본 한 줄:** `Comfy-Org/Fibo-2.0`(Bria 8B. 원본 `briaai/Fibo-2.0-dev` 는 gated 지만 이 재패키지는 아니다), CC BY-NC 4.0, ComfyUI 0.43.0+ 네이티브. 2026-10-18 공개라 파생판 생태계 나이가 2주다. 상세는 선행 문서 §6.

### 5.1 Hugging Face — `finetune` 라벨 11개 중 실제 파인튜닝은 0개

`briaai/Fibo-2.0-dev`·`briaai/Fibo-2.0-edit-turbo`·`Comfy-Org/Fibo-2.0` 을 base_model 로 단 리포는 41개다(quantized 27 / finetune 11 / adapter 3). 그런데 **`finetune` 으로 달린 11개는 재패키지·미러·양자화 9개, 웨이트 없이 양자화 스크립트만 있는 리포 1개, LoRA 1개다.** 모델 본체를 다시 학습한 리포는 없다. [D43]

| 리포 ID | 종류 | 뭘 바꿨나 | dl / likes | 라이선스 영향 |
| --- | --- | --- | --- | --- |
| `Comfy-Org/Fibo-2.0` | **공식 ComfyUI 재패키지** (라벨은 finetune) | 키 이름 변경·Q/K/V 융합한 bf16 과 int8_convrot. 학습 없음 | 264445 / 225 | CC BY-NC 4.0 |
| └ `loras/fibo_2.0_turbo_lora_avg_rank_270_bf16.safetensors` | **진짜 개조 (차분 LoRA 추출)** | Edit Turbo 를 LoRA(평균 rank 270, 1.99GB)로 뽑아 dev(non-turbo)에 얹는 용도. "turbo LoRA 를 뽑아 non-turbo 모델에 쓸 수 있나"라는 요청에 Kijai 가 "Added." 로 답하며 올렸다 | (위 리포에 포함) | CC BY-NC 4.0 [D38] |
| `akhaliq/Fibo-2.0-8step-smd` | **진짜 개조 (속도 증류 LoRA, WIP)** | dev 를 teacher 로 SMD 증류한 rank-128 LoRA. 8 step / CFG 1 T2I | 0 / 1 | CC BY-NC 4.0 [D35] |
| `axiomofmind/Fibo-2.0-anime-lora` | **진짜 개조 (스타일 LoRA)** | 애니메·세이넨 화풍. 400 step 파일럿 체크포인트 | 195 / 1 | bria-fibo (CC BY-NC) [D36] |
| `axiomofmind/Fibo-2.0-psychedelic-lora` | **진짜 개조 (스타일 LoRA)** | 사이키델릭 팝 일러스트 화풍 | 153 / 2 | bria-fibo (CC BY-NC) [D37] |
| `siraxe/3dhardware_fibo2` | **진짜 개조 (LoRA, 라벨은 finetune)** | Edit Turbo 용 117MB LoRA. 카드는 "set to 0.8-1.0" 한 줄 | 0 / 0 | 미기재 [D42] |
| `ml-resources/Fibo-2.0-dev` · `-edit-turbo` | **ungated 미러** | 카드에 "Mirror … Not an official release" 명시. 1.x 리포까지 전부 복제 | 120 · 100 / 1 · 1 | 원본 그대로 [D41] |
| `0xSojalSec/Fibo-2.0`, `KazumaSensei/Fibo-2.0`, `DeepBeepMeep/Fibo2`, `theunlikely/…-ComfyUI`, `NidAll/…-BF16` | **미러·재패키지** | `Comfy-Org` 파일 복사 또는 bf16 재변환. `theunlikely`·`NidAll` 은 변환·검증 문서를 같이 둔다 | 139 / 0 / 0 / 0 / 0 | 원본 그대로 |
| `realrebelai/Fibo-2.0_GGUFs`, `Abiray/Fibo-2.0-edit-turbo-GGUF`, `vantagewithai/…-GGUF`, `molbal/fibo-2.0-GGUF`, `AbrahamPJ/…-q4_0-gguf`, `gguf-org/fibo2-gguf` | **양자화 재포장 (GGUF)** | 형식 변환만 | 5877 · 3232 · 3149 · 3021 · 732 · 97 | 원본 그대로 |
| `BennyDaBall/…-NVFP4` ×2, `akhaliq/…-edit-turbo-ComfyUI`, `NidAll/…-INT8-ConvRot`, `WaveCut/…-OrbitQuant-W4A8` ×2, `Winnougan/Fibo-2.0-w6a8-convrot`, `rupeshs/fibo2-edit-turbo-int4-ov`, `mingyi456/…-DF11-ComfyUI` ×2 | **양자화 재포장** | NVFP4 / FP8 / INT8 / W4A8 / W6A8 / OpenVINO INT4 / DF11. `akhaliq/Fibo-2.0-edit-turbo-fp8` 은 웨이트 없이 스크립트만 있다 | 581·480 / 0 / 0 / 0·0 / 0 / 0 / 128·20 | 원본 그대로 (`Winnougan` 은 태그만 apache-2.0) |
| `mflux-community/fibo-2-0-*` (q3~bf16 12개), `Ouinche/FIBO2-Edit-Turbo-MLX-4bit`, `npario/…-mflux-q8` | **양자화 재포장 (MLX)** | Apple Silicon 용 | 최대 1156 (edit-turbo q4) | 원본 그대로 |
| `AcademiaSD/Fibo-2.0-NF4-for-LoRA-Training` | **양자화** | diffusers 레이아웃 NF4. 이름상 LoRA 학습용(카드 미열람) | 77 / 1 | CC BY-NC 4.0 |

**이름보다 파일 목록을 봐야 하는 리포가 있다.** `lvladikov/FIBO2-Edit-Turbo-T2I`(likes 6)와 `reverentelusarca/fibo-2.0-2K-rope`(likes 3)는 이름만 보면 개조 모델 같지만 **웨이트가 없다.** 앞의 것은 워크플로·스크립트, 뒤의 것은 ComfyUI 워크플로 JSON 하나다. 둘 다 §5.3 에서 다룬다. README 없는 LoRA 리포(`tvoi-dominator/aipril-lora-fibo` 398MB 등)도 몇 개 있다.

**학습 도구는 이미 있다.** ostris `ai-toolkit` 에 `fibo2` 아키텍처가 내장돼 있다. `Buattensorart2/ostris_fibo_loras_nami` 의 학습 설정이 실제 사용 예다 — `arch: fibo2`, `name_or_path: Comfy-Org/Fibo-2.0`, LoKr(linear 16, factor 8), `convrot8` 양자화, 3000 step. [D44][D45]

### 5.2 Civitai — 베이스모델 태그가 없고, 워크플로가 대부분이다

Civitai 에는 Fibo 용 `baseModel` 값이 없다. `baseModels=Fibo 2.0` / `Fibo` / `FIBO 2.0` / `Bria Fibo` 는 모두 0건이고, 올라온 항목은 `Other` 로 등록된다(일부는 `Qwen 2`·`Upscaler`·`Flux.3 Klein` 으로 잘못 태깅). 그래서 `query=fibo` 이름 검색으로만 찾았다. [D30]

| 이름 | 종류 | downloadCount | 실체 |
| --- | --- | --- | --- |
| FIBO 2.0 Generate + Edit \| 4-Step Turbo, Auto Prompt | Workflows | 1009 | 워크플로 |
| Fibo-2.0 \| Native 2K 4MP Workflow \| Edit-T2I-Upscale | Workflows | 478 | 워크플로 (`Qwen 2` 로 태깅) |
| FIBO 2.0 Image workflows (T2I+Edit, Inpaint, SeedVR2 Upscale + prompt enchancer) | Workflows | 430 | 워크플로 |
| FIBO 2.0 T2I + Editing | Workflows | 372 | 워크플로 |
| Fibo 2.0 DEV - TURBO EDIT - GGUF | Checkpoint | 289 | 양자화 |
| Easy FIBO Reference Image with detailers & upscale | Workflows | 179 | 워크플로 |
| Fibo 2.0 Turbo/Base Character LoRA Pipeline V2 | Workflows | 177 | 워크플로 |
| Enzino Edit Studio · Fibo 2 Edit Turbo | Workflows | 175 | 워크플로 |
| Fibo edit - refine/reimagine/deslop anything | Workflows | 114 | 워크플로 |
| Fibo 2.0 Dev GGUF (Image Edit) / (Text-to-image) | Checkpoint | 104 / 66 | 양자화 |

→ **이름 검색으로는 Civitai 에 Fibo 2.0 LoRA·파인튜닝 체크포인트가 하나도 나오지 않는다.** 체크포인트 3개는 전부 GGUF 재업로드다. FLUX 3 Klein 처럼 커뮤니티 노력이 **모델을 고치기보다 공식 모델을 어떻게 연결할지**에 쏠려 있는데, Klein 에 전용 LoRA 가 몇 개라도 있었던 것과도 다르다.

### 5.3 평가 좋은 것

**`lvladikov/FIBO2-Edit-Turbo-T2I` — 웨이트 없이 4-step T2I 를 여는 사용법**

Edit Turbo 는 편집 모델로 나왔지만 **입력 이미지 없이 호출하면 4 step / CFG 없이 T2I 를 한다.** 이 리포는 그 관찰을 ComfyUI 워크플로 2개(bf16·int8 용, GGUF 용), diffusers 스크립트, Apple Silicon(MLX) 스크립트로 정리했다. 모델 파일은 없고 전부 원 소유자 리포에서 받는다. 워크플로·스크립트는 Apache-2.0, 모델은 CC BY-NC 4.0 그대로다. [D39]

- **로컬 VGL 캡션:** diffusers 스크립트는 파이프라인 자체의 Qwen3-VL-4B-Instruct 가 `bria-vgl` 의 생성 지시문으로 VGL 캡션을 쓰게 한다. Gemini 키 없이 구조화 프롬프트를 만든다. 22개 예시를 평문·VGL 두 방식으로 렌더해 공개했다.
- **실패 사례를 숨기지 않았다:** "4인 가족을 바로 위에서" 프롬프트에서 평문·VGL 둘 다 6명을 그렸다. VGL 쪽은 모델이 쓴 캡션이 사람을 개별 객체로 나열하지 않은 탓도 있었고, 사람을 객체별로 적은 **수정 캡션으로는 정확히 4명**이 나왔다. 피아니스트(손)·우주선(세부)도 평문 / VGL / 수정 캡션 3방식으로 비교했다.
- **주의:** 네이티브 노드 기준 워크플로다. 서드파티 `drphero/ComfyUI-Fibo2` 팩은 자체 로더와 `Fibo2 Edit Conditioning` 노드를 쓰므로 섞지 말라고 적는다.

**`akhaliq/Fibo-2.0-8step-smd` — 지표를 공개한 속도 증류 (WIP)**

dev(카드 기준 30 step, CFG 5)를 teacher 로 SMD(on-policy velocity regression, arXiv 2610.18472) 증류한 **8-step, CFG 1 T2I LoRA**다. rank-128, fp32 EMA, attention q/k/v/out 과 FFN w1/w2/w3 전부가 대상이다. 학습 데이터는 VGL JSON 캡션 1,200개, A100·H200 에서 약 5,500 업데이트. [D35]

- **수치:** 6개 프롬프트 기준 dev 30-step 대비 LPIPS **0.467** 로 Edit Turbo 4-step(0.485)보다 가깝다. 시계 제품샷에서는 Edit Turbo 가 케이스를 뒤틀린 반면 이 LoRA 는 깨끗하게 그렸다고 적는다.
- **한계(카드가 직접 밝힘):** 도서관 계단이 책장에 녹아드는 구조 실패, 라멘 간판 위 거울상 중복 글자. **4 step 은 LPIPS 0.627 로 못 쓴다** — 8 step 고정.
- **만든 이유:** Edit Turbo 의 4-step T2I 는 공짜로 꽤 되지만 정밀한 피사체에서 무너진다는 것. 제작자가 별도 벤치마크 데이터셋으로 근거를 남겼다.
- **ComfyUI 는 아직이다.** LoRA 를 **fp32 로 적용**해야 하고, 일반 bf16 병합은 증류 델타 대부분을 반올림으로 날린다(MOSS 유사 설정에서 델타 상대오차 약 81% 측정). fp32 적용 커스텀 노드와 병합 체크포인트는 로드맵에만 있다. 같은 제작자의 MOSS 4-step(§3)과 같은 경로를 밟는 중이다.

**`axiomofmind` 스타일 LoRA 2종 — ComfyUI 변환본을 같이 준다**

`Fibo-2.0-anime-lora`(트리거 `fibo_seinen_style`, 400 step 파일럿)와 `Fibo-2.0-psychedelic-lora`(트리거 `fibo_psychpop_style`). 둘 다 dev 전용(Edit Turbo 아님)이고 scale 0.7 권장(1.0 은 강하게), 50 step / CFG 5 / 1024², 트리거는 VGL JSON 의 `style_medium` 맨 앞에 둔다. [D36][D37]

쓸모 있는 건 **ComfyUI 레이아웃 문제를 짚었다**는 점이다. diffusers/PEFT LoRA 는 `to_q`·`to_k`·`to_v` 를 따로 갖는데 ComfyUI 네이티브 Fibo 2.0 은 Q/K/V·K/V·SwiGLU W1/W3 를 **융합**한 구조라 키가 맞지 않는다. 그래서 `…-ComfyUI.safetensors` 변환본을 따로 넣었고, ComfyUI 에서는 표준 LoRA 로더에 model strength 0.7 / clip strength 0.0 으로 쓰라고 한다(psychedelic 카드 기준). 같은 제작자가 MOSS LoRA 3종(§3)도 냈다.

**`reverentelusarca/fibo-2.0-2K-rope` — 네이티브 2K 늘어짐 완화 설정**

Fibo 2.0 은 2K 이상에서 디테일은 좋아지지만 사람이 길게 늘어나고 배경이 반복된다. 제작자는 커스텀 sigma 로는 실패했고 **RoPE 를 조정**해서 늘어짐을 크게 줄였다고 적는다. 워크플로(`Fibo2_turbo_edit_2K-ROPE.json`)의 실제 설정은 Edit Turbo int8 + 코어 노드 **`ScaleROPE`(scale_x 0.85, scale_y 0.8)** + **8 step** / CFG 1 / euler / simple 이고, 해상도는 입력 이미지를 약 4MP 로 맞추는 수식으로 계산한다. 업스케일·2-pass 없이 직접 2K 를 뽑는다. 근거는 외부 이미지 비교 링크뿐이고 정량 지표는 없다. [D40]

---

## 6. 양자화 재포장 vs 진짜 개조

리포 이름만으로는 구분이 안 되는 사례들을 모았다.

| 리포 ID | 이름이 주는 인상 | 실제 | 판정 |
| --- | --- | --- | --- |
| `abenzerps/Qwen-Image-2.1-Uncensored-Quantized` | 검열 해제 + 양자화 | 체크포인트는 형식 변환만. 검열 해제는 동봉 LoRA 파일 | **양자화 + 별도 LoRA** [D1] |
| `webmp3/Sakura-FLUX.3-Image-Klein-GGUF` | 애니메 파인튜닝 | `base_model_relation: quantized`, 인코더·VAE 도 공식 사본 | **양자화** [D15] |
| `toxicdog/FLUX.3-Image-Klein-INT4-ConvRot-ComfyUI` | 양자화 | INT4 + **q/k/v 를 `qkv` 로 융합**(구조 변경). 재학습은 없음 | **양자화 + 구조 변경** [D27] |
| `toxicdog/MOSS-Image-SFT-Turbo-INT8-ConvRot` | 양자화 | "8-step variant" 라고 쓰면서 **그 8-step 을 어떻게 얻었는지 미기재** | **판정 보류** [D26] |
| `ml-resources/flux-3-image-klein-comfy` | 공식 리포 | ungated 미러. BF16 transformer·ae 는 원본과 일치. 퍼블리셔 미기재 | **미러/재패키징** [D28] |
| `AtomicChat/FLUX-3-Image-Klein-pup-Uncensored-GGUF` | GGUF | **upsampler 웨이트에 rank-1 abliteration 적용 후** GGUF | **진짜 개조(부품)** [D14] |
| `pottokao/Qwen-Image-2.1-Text-Encoder-Heretic-GGUF` | GGUF | 인코더 directional ablation | **진짜 개조(부품)** [D7] |
| `Langzaigg/moss-image-anime-turbo` | 파인튜닝 | turbo 파생 + NSFW LoRA 0.7 **병합** 체크포인트 | **진짜 개조(병합)** [D22] |
| `MATLOWAI/MOSS-Image-SFT-DeBand` | 신규 학습 | 학습 없음. **SFT 레이어를 Base 로 되돌리는 차분** | **진짜 개조(웨이트 치환)** [D11] |
| `Noctaluna/Noct-Q-*` | 양자화(int8 파일명) | 파일은 int8 이지만 **transformer 웨이트가 수정된 머지** | **진짜 개조(머지)** [D6][D21] |
| `lvladikov/FIBO2-Edit-Turbo-T2I` | T2I 용 개조 모델 | **웨이트 없음.** 공식 Edit Turbo 를 이미지 없이 돌리는 워크플로·스크립트 | **사용법** [D39] |
| `reverentelusarca/fibo-2.0-2K-rope` | 2K 개조 모델 | **웨이트 없음.** `ScaleROPE` 설정이 든 워크플로 JSON 하나 | **설정** [D40] |
| `Comfy-Org/Fibo-2.0` | 파인튜닝(`finetune` 라벨) | 키 이름 변경·Q/K/V 융합뿐. 단 `loras/` 의 Turbo LoRA 는 차분 추출 | **재패키지 + 차분 LoRA 1개** [D38] |
| `siraxe/3dhardware_fibo2` | 파인튜닝(`finetune` 라벨) | 117MB LoRA 파일 하나 | **LoRA** [D42] |
| `ml-resources/Fibo-2.0-dev` | 공식 리포 | 카드가 "Mirror … Not an official release" 명시. 원본 gated 를 우회 | **미러** [D41] |

**빠른 판별법**
1. HF 모델 카드 메타데이터의 `base_model_relation` 을 본다. `quantized` 면 원칙적으로 값이 안 바뀐 것이다.
2. 파일명에 `GGUF`·`FP8`·`INT8`·`NVFP4`·`MLX`·`convrot` 만 있고 step/CFG 권장값이 **원본과 같으면** 재포장이다.
3. 권장 step 이 원본보다 **줄어 있으면**(50→8, 40→6) 증류가 섞인 것이다.
4. `-Uncensored`·`-abliterated`·`-Heretic` 이름은 **DiT 가 아니라 텍스트 인코더/upsampler** 를 고친 경우가 많다. 어느 부품인지 카드에서 확인해야 한다.
5. **`finetune` 라벨도 믿지 않는다.** Fibo 2.0 에서 `finetune` 으로 달린 11개 중 실제 파인튜닝은 0개였다.
6. 리포에 **웨이트가 아예 없는** 경우도 있다(워크플로·설정·스크립트 공유). 파일 목록을 먼저 본다.
7. Fibo 2.0 LoRA 는 **diffusers 레이아웃이면 ComfyUI 네이티브에서 키가 맞지 않는다.** `-ComfyUI` 변환본이 있는지 확인한다.

---

## 7. 조합 레시피

> 모든 경로는 `ComfyUI/models/` 기준. 근본 파일 배치는 선행 문서 §8 과 동일하고, **여기서는 추가·교체분만** 적는다.

### 레시피 A — Qwen 2.1 품질 우선 (VAE 만 바꾼다)

```
diffusion_models/qwen_image_2.1_int8_convrot.safetensors          # Comfy-Org 공식
text_encoders/qwen3vl_8b_int8_convrot.safetensors                 # Comfy-Org 공식
vae/texture_fix_vae_for_qwen_image_2.1_bf16.safetensors           # ← 교체 (madebyollin)
```

- `Load VAE` 노드에서 순정 `qwen_image_2.1_vae_bf16.safetensors` 대신 위 파일 선택.
- 샘플러: 25 step / cfg 1 / euler / simple (공식 기본값 유지).
- 얻는 것: 체커보드 제거(rFID 3.38→2.07), fp16 NaN 0건. 잃는 것: PSNR 0.5dB.
- **가장 비용이 싼 개선이다. 파일 하나 교체에 추가 VRAM 도 없다.** [D4]

### 레시피 B — Qwen 2.1 속도 우선 (VAE 교체 + 증류 LoRA)

```
diffusion_models/qwen_image_2.1_int8_convrot.safetensors          # ★ Turbo 가 아니라 base 를 쓴다
text_encoders/qwen3vl_8b_int8_convrot.safetensors
vae/texture_fix_vae_for_qwen_image_2.1_bf16.safetensors
loras/Qwen-Image-2.1-viggle-turbo-v0.3-6step-lora-r256.safetensors
```

- 노드: `Viggle Turbo LoRA (unmerged)` + `Viggle Turbo Sigmas` + `euler` + `BasicGuider`.
  (Viggle 리포 `comfyui/viggle_turbo.py` 를 설치. 순정 LoRA 로더는 병합해서 bf16 에서 업데이트 약 30% 손실.)
- 스케줄러 설정을 Viggle 동봉 `scheduler/`(`shift_terminal: null`)로 교체.
- 6 step / cfg 1 / negative 없음. 1248×832 기준 VRAM 피크 약 26GB.
- **대안:** 텍스트 정확도가 더 중요하면 `loras/turbo8_lora_step2500.safetensors`(8 step / cfg 1 / euler / simple, `ModelSamplingFlux` max_shift 0.6935 base_shift 0.5). OCR exact-match 가 95%→75% 로 깎이지만 그 수치를 공개한 쪽이다.
- **경고:** 둘 다 공식 `Qwen-Image-2.1-Turbo` 체크포인트 위에 얹는 게 아니다. **베이스 모델 위에 얹는다.** [D3][D20][D4]

### 레시피 C — MOSS 올인원 (밴딩 수정 + 속도, 단일 파일)

```
diffusion_models/moss_image_sft_deband_fast_dmd035_int8_convrot.safetensors   # MATLOWAI, 약 5.4GB
text_encoders/qwen3.5_9b_int8_convrot.safetensors                             # Comfy-Org/MOSS-Image
vae/flux2-vae.safetensors                                                     # Comfy-Org/MOSS-Image
```

- DeBand 수정 + lodestones 8-step DMD LoRA 0.35 가 **이미 병합된 단일 파일**이라 커스텀 노드가 필요 없다. 순정 `Load Diffusion Model` 로 로드.
- **10 step**, 워크플로는 `moss_deband_int8.json`. 권장 샘플러 ER-SDE, CFG 3, Temporal Score Rescaling + layer 22·24 skip-layer guidance.
- 품질 우선이면 같은 리포의 `moss_image_sft_deband_plus_int8_convrot.safetensors`(25 step).
- **병합본을 쓰는 이유:** MOSS 증류 델타는 bf16 반올림보다 작아서 **직접 LoRA 를 병합하면 효과가 날아간다.** 제작자가 fp32 에서 병합해준 파일을 받는 쪽이 안전하다. [D24][D11][D8]

### 레시피 D — MOSS 품질 최대 + 스타일 (LoRA 스택)

```
diffusion_models/moss_image_sft_int8_convrot.safetensors          # Comfy-Org 공식 SFT
text_encoders/qwen3.5_9b_w4a8_gptq.safetensors
vae/flux2-vae_small.safetensors
loras/moss_image_sft_banding_fix_L37-41_bf16.safetensors          # DeBand 메인 (strength 1.0)
loras/moss_image_sft_banding_fix_L32-36_extra_bf16.safetensors    # Quality+ 용, 선택 (strength 1.0)
loras/MOSS-Image-Anime-LoRA-ComfyUI.safetensors                   # axiomofmind, model 1.0 / clip 0.0
```

- 노드 순서: 모델 로드 → `LoraLoaderModelOnly`(DeBand) → (선택) `LoraLoaderModelOnly`(DeBand extra) → LoRA 로더(스타일).
- **50 step / CFG 3.0 / shift 5 / negative 비움.** 스타일 LoRA 는 트리거 없이 "anime character" 를 자연어로 쓰는 편이 낫다는 게 제작자 비교 결과다.
- 스타일 LoRA 는 반드시 **`*-ComfyUI.safetensors`** 를 쓴다. 루트 PEFT 파일은 키 이름이 달라 "lora key not loaded" 가 난다. ComfyUI 커밋 `b1a247c` 이상 필요.
- Quality+ 를 쓰면 밴딩은 1.09 까지 내려가지만 SFT 유사도가 약 76% 로 떨어진다(= Base 쪽 그림에 가까워진다). [D11][D12]

### 레시피 E — MOSS 로 이미지 편집 (공식에 없는 기능)

```
diffusion_models/moss_image_sft_int8_convrot.safetensors
text_encoders/qwen3.5_9b_w4a8_gptq.safetensors
vae/flux2-vae_small.safetensors
loras/armV5.safetensors                                           # akhaliq/MOSS-Image-Edit-HQ
```

- **ComfyUI v0.42.1 초과 필요.** `Text Encode MOSS-Image Edit` 노드의 `edit_format` 을 **`ai-toolkit`** 으로 설정.
- flow-matching Euler / shift 5.0 / **50 step / CFG 3.0**. bf16 기준 **약 20GB+ VRAM**.
- 단일 레퍼런스 편집이 강하고 **다중 레퍼런스 합성은 약하다**(v4 가 단일 쌍으로 학습됨).
- 속도가 필요하면 8-step DMD LoRA 를 겹칠 수 있지만 50-step 대비 결과가 부드러워진다.
- **현실적 평가:** 편집이 꼭 필요하면 Qwen-Image-2.1 (공식 통합 편집, 레퍼런스 10장, 마스크, RGBA)이 여전히 낫다. 이 레시피는 **MOSS 하나만 깔아두고 가끔 편집이 필요한 경우**의 보완책이다. [D17]

### 레시피 F — FLUX 3 Klein

```
(선행 문서 §8 의 공식 배치 그대로. 추가 없음.)
```

- **얹을 게 없다.** HF 상위권은 전부 양자화이고, Civitai 의 Klein 전용 LoRA 는 최상위도 4,633 다운로드 수준이다.
- VRAM 이 부족하면 `flux3-image-klein-int8-convrot.safetensors`(공식 int8) 또는 `toxicdog` INT4 ConvRot(3.19GB) 로 내린다. **GGUF 는 속도가 아니라 VRAM 을 위한 선택이다** — Sakura 측정에서 GGUF 40.2s vs BF16 36.2s 로 오히려 느렸다.
- prompt upsampler 의 거부가 문제가 되면 `AtomicChat` pup-Uncensored 로 교체할 수 있으나 **사용 경로가 `llama-server` 기준이고 ComfyUI 통합이 카드에 없다.** 텍스트 인코더 쪽(`TE-Uncensored`)은 **ComfyUI 에서 작동하지 않는다**(Qwen3-4B 로 오인식되어 샘플러 실패). [D15][D27][D14][D25]

### 레시피 G — Fibo 2.0 빠른 T2I (Edit Turbo 를 이미지 없이)

```
diffusion_models/fibo2_edit_turbo_int8_convrot.safetensors        # Comfy-Org 공식
text_encoders/qwen3vl_4b_bf16.safetensors                         # Comfy-Org 공식
vae/flux2-vae.safetensors                                         # Comfy-Org 공식
```

- `TextEncodeFibo2` 에 이미지를 **연결하지 않으면** T2I 가 된다. 4 step / CFG 1, 샘플러는 공식 편집 템플릿과 같은 euler / simple. 워크플로는 `lvladikov` 의 `FIBO2-Edit-Turbo-T2I-ComfyUI.json`(GGUF 판은 `…-GGUF.json`).
- 추가 파일·커스텀 노드가 없다. 편집용으로 받은 파일을 그대로 T2I 에 쓴다.
- **약점:** 인원수·손·복잡한 구조물에서 틀린다. 평문 대신 사람·물체를 객체별로 적은 VGL 캡션을 넣으면 일부 고쳐진다. [D39][D35]
- 정밀도가 더 필요하면 `akhaliq` 8-step SMD LoRA 가 지표상 앞서지만(LPIPS 0.467 vs 0.485) 아직 diffusers 경로뿐이고, ComfyUI 는 fp32 적용 노드가 나와야 한다. dev 에 Kijai Turbo LoRA 를 얹는 길도 있으나 권장 strength·step 이 공개되지 않았다. [D35][D38]

### 레시피 H — Fibo 2.0 네이티브 2K (RoPE 조정)

```
(레시피 G 와 같은 파일. 추가 없음.)
```

- 모델 뒤에 코어 노드 `ScaleROPE` 를 넣고 **scale_x 0.85 / scale_y 0.8**, 8 step / CFG 1 / euler / simple, 해상도 약 4MP. 워크플로는 `reverentelusarca` 의 `Fibo2_turbo_edit_2K-ROPE.json`(편집용).
- 효과의 근거는 제작자의 육안 비교뿐이다. ComfyUI 0.43.0 의 Fibo 2.0 RoPE 스케일링 변경(NTK-aware, #17290)과 어떻게 맞물리는지는 확인되지 않았다. [D40]

### 레시피 I — Fibo 2.0 스타일 LoRA

```
diffusion_models/fibo2_dev_int8_convrot.safetensors               # ★ Edit Turbo 가 아니라 dev
text_encoders/qwen3vl_4b_bf16.safetensors
vae/flux2-vae.safetensors
loras/Fibo-2.0-Psychedelic-LoRA-ComfyUI.safetensors               # ← 추가 (axiomofmind, ComfyUI 변환본)
```

- 표준 LoRA 로더에 model 0.7 / clip 0.0, 50 step / CFG 5. 트리거 `fibo_psychpop_style` 를 VGL JSON `style_medium` 맨 앞에 둔다.
- **반드시 `-ComfyUI` 변환본을 쓴다.** diffusers 원본(`pytorch_lora_weights.safetensors`)은 ComfyUI 의 융합 레이어와 키가 맞지 않는다. 애니메 LoRA(`Fibo-2.0-Anime-LoRA-ComfyUI.safetensors`, 트리거 `fibo_seinen_style`)도 같다. [D36][D37]

---

## 8. 확인 불가 항목

| 항목 | 상태 |
| --- | --- |
| Civitai 각 베이스모델의 **총 LoRA 개수** | API `/models` 가 cursor 페이지네이션이라 `totalItems` 를 주지 않는다. 상위 20개까지만 확인했다 |
| Civitai API 응답 **전체** | WebFetch 가 10만 자에서 잘린다. `Flux.3 Klein` LoRA 는 14개째, `Qwen 2.1` LoRA 는 10개째, `MOSS Image` LoRA 는 9개째에서 절단 |
| `civitai.com/models/3003556` 페이지 직접 열람 | **HTTP 403**. API 는 되지만 HTML 페이지는 차단된다 |
| Civitai 다중 베이스 LoRA 의 **Klein/Qwen/MOSS 전용 다운로드 수** | `downloadCount` 가 모델 전체 누적이라 버전별 분해 불가 |
| `AtomicChat/Qwen-Image-2.1-Turbo-Uncensored-GGUF` (dl 650539 / likes 691) | 모델 카드 미열람. 동일 제작자의 FLUX 리포 패턴상 부품 abliteration 으로 **추정**되나 확인 안 함 |
| `toxicdog/MOSS-Image-SFT-Turbo-INT8-ConvRot` 의 "8-step" 출처 | 카드가 어떤 증류 LoRA 를 어떤 강도로 넣었는지 적지 않는다 |
| `lightx2v/Qwen-Image-2.1-Lightning` 라이선스 | **모델 카드에 라이선스 기재 없음.** 베이스가 Qwen Research 이므로 파생물도 비상업으로 보는 게 안전하나 명시적 근거는 없다 |
| `chinoll/Moss-Image-Edit` **웨이트** 라이선스 | 코드만 GPLv3 명시. 웨이트 라이선스 필드 비어 있음 |
| `ml-resources/flux-3-image-klein-comfy` 퍼블리셔 | 카드가 누가 만든 미러인지 밝히지 않는다. **gated 우회 수단이므로 BFL 약관상 지위도 불명** |
| `abenzerps` 리포의 "Uncensored" 실체 | 동봉 LoRA(`qwen-image-2.1-uncensored-lora.safetensors`) 가 담당하는 것까지 확인됨. **그 LoRA 의 학습 방법·데이터는 카드에 없음** |
| 파생판들의 **한국어 프롬프트 / 한글 렌더링** | 선행 문서와 동일하게 어느 카드에도 자료 없음 |
| 증류 LoRA 들의 **상호 비교 정량 지표** | akhaliq 가 lodestones·darask0 와 시각 비교를 했을 뿐, 제3자 벤치마크 없음 |
| r/StableDiffusion·r/comfyui **커뮤니티 중론** | reddit 크롤러 차단으로 선행 문서와 동일하게 확인 불가 |
| FLUX 3 Klein **`-base` 를 쓴 실제 파인튜닝 사례** | HF·Civitai 어디서도 발견하지 못했다. BFL 은 Klein Base 가 파인튜닝에 적합하다고 안내하지만(FLUX.2 기준 문서), FLUX 3 Klein 에 대한 공개 결과물은 찾지 못함 |
| Civitai 의 **Fibo 2.0 LoRA** | Fibo 용 `baseModel` 값이 없어(`Other` 로 등록) 이름 검색(`query=fibo`)으로만 찾았다. 이름에 fibo 가 없는 LoRA 는 빠졌을 수 있다 |
| Kijai Turbo LoRA 의 **권장 strength·step** | 토론 #2 의 답이 "Added." 뿐이고 README 에도 없다 |
| `akhaliq` SMD LoRA 의 **ComfyUI 사용** | fp32 적용 커스텀 노드·병합 체크포인트가 로드맵에만 있다. LPIPS 지표도 제작자 자체 측정(6개 프롬프트) |
| `reverentelusarca` 2K RoPE 설정과 ComfyUI 0.43.0 **RoPE NTK-aware 변경(#17290)** 의 관계 | 워크플로 등록(2026-10-21)과 변경 반영의 선후·상호작용 미확인 |
| README 없는 LoRA 리포 (`tvoi-dominator/aipril-lora-fibo` 398MB, `Buattensorart2/ostris_fibo_loras_nami`, `Jacob121294/fibo2-trainprobe-lora` 빈 리포) | 용도·학습 데이터 미기재 |
| `siraxe/3dhardware_fibo2` | 카드가 "set to 0.8-1.0" 한 줄뿐, 라이선스 미기재 |

---

## 9. 출처 목록

### Qwen-Image-2.1 파생판
- **[D1]** `abenzerps/Qwen-Image-2.1-Uncensored-Quantized`: <https://huggingface.co/abenzerps/Qwen-Image-2.1-Uncensored-Quantized>
- **[D2]** `lightx2v/Qwen-Image-2.1-Lightning`: <https://huggingface.co/lightx2v/Qwen-Image-2.1-Lightning>
- **[D3]** `Viggle/Qwen-Image-2.1-viggle-turbo`: <https://huggingface.co/Viggle/Qwen-Image-2.1-viggle-turbo>
- **[D4]** `madebyollin/texture-fix-vae-for-qwen-image-2.1`: <https://huggingface.co/madebyollin/texture-fix-vae-for-qwen-image-2.1>
- **[D5]** `alibaba-pai/Qwen-Image-2.1-Fun-Controlnet-Union`: <https://huggingface.co/alibaba-pai/Qwen-Image-2.1-Fun-Controlnet-Union>
- **[D6]** `Noctaluna/Noct-Q-Uncensored-Qwen-Image-2.1`: <https://huggingface.co/Noctaluna/Noct-Q-Uncensored-Qwen-Image-2.1>
- **[D7]** `pottokao/Qwen-Image-2.1-Text-Encoder-Heretic-GGUF`: <https://huggingface.co/pottokao/Qwen-Image-2.1-Text-Encoder-Heretic-GGUF>
- **[D19]** `WarmBloodAban/Qwen-Image-2.1-LoRAs`: <https://huggingface.co/WarmBloodAban/Qwen-Image-2.1-LoRAs>
- **[D20]** `chriswritescode/Turbo8-LoRA-Qwen-Image-2.1`: <https://huggingface.co/chriswritescode/Turbo8-LoRA-Qwen-Image-2.1>
- **[D21]** `Noctaluna/Noct-Q-Anime-Uncensored-Qwen-Image-2.1`: <https://huggingface.co/Noctaluna/Noct-Q-Anime-Uncensored-Qwen-Image-2.1>

### MOSS-Image 파생판
- **[D8]** `lodestones/MOSS-Image-SFT-8-steps-dmd`: <https://huggingface.co/lodestones/MOSS-Image-SFT-8-steps-dmd>
- **[D9]** `akhaliq/MOSS-Image-SFT-4-steps`: <https://huggingface.co/akhaliq/MOSS-Image-SFT-4-steps>
- **[D10]** `axiomofmind/Moss-image-nsfw-uncensored-lora`: <https://huggingface.co/axiomofmind/Moss-image-nsfw-uncensored-lora>
- **[D11]** `MATLOWAI/MOSS-Image-SFT-DeBand`: <https://huggingface.co/MATLOWAI/MOSS-Image-SFT-DeBand>
- **[D12]** `axiomofmind/Moss-image-anime-lora`: <https://huggingface.co/axiomofmind/Moss-image-anime-lora>
- **[D13]** `chinoll/Moss-Image-Edit`: <https://huggingface.co/chinoll/Moss-Image-Edit>
- **[D17]** `akhaliq/MOSS-Image-Edit-HQ`: <https://huggingface.co/akhaliq/MOSS-Image-Edit-HQ>
- **[D18]** `darask0/MOSS-Image_4-step_adapter_lora` (rapid-moss): <https://huggingface.co/darask0/MOSS-Image_4-step_adapter_lora>
- **[D22]** `Langzaigg/moss-image-anime-turbo`: <https://huggingface.co/Langzaigg/moss-image-anime-turbo>
- **[D23]** `congruency/MOSS-Image-Turbo-MFD`: <https://huggingface.co/congruency/MOSS-Image-Turbo-MFD>
- **[D24]** `MATLOWAI/MOSS-Image-SFT-DeBand-int8`: <https://huggingface.co/MATLOWAI/MOSS-Image-SFT-DeBand-int8>
- **[D26]** `toxicdog/MOSS-Image-SFT-Turbo-INT8-ConvRot`: <https://huggingface.co/toxicdog/MOSS-Image-SFT-Turbo-INT8-ConvRot>
- **[D29]** `axiomofmind/Moss-image-beauty-lora`: <https://huggingface.co/axiomofmind/Moss-image-beauty-lora>

### FLUX 3 Image Klein 파생판
- **[D14]** `AtomicChat/FLUX-3-Image-Klein-pup-Uncensored-GGUF`: <https://huggingface.co/AtomicChat/FLUX-3-Image-Klein-pup-Uncensored-GGUF>
- **[D15]** `webmp3/Sakura-FLUX.3-Image-Klein-GGUF`: <https://huggingface.co/webmp3/Sakura-FLUX.3-Image-Klein-GGUF>
- **[D16]** `prithivMLmods/flux-3-image-klein-prompt-upsampler-abliterated-GGUF`: <https://huggingface.co/prithivMLmods/flux-3-image-klein-prompt-upsampler-abliterated-GGUF>
- **[D25]** `AtomicChat/FLUX-3-Image-Klein-TE-Uncensored-GGUF`: <https://huggingface.co/AtomicChat/FLUX-3-Image-Klein-TE-Uncensored-GGUF>
- **[D27]** `toxicdog/FLUX.3-Image-Klein-INT4-ConvRot-ComfyUI`: <https://huggingface.co/toxicdog/FLUX.3-Image-Klein-INT4-ConvRot-ComfyUI>
- **[D28]** `ml-resources/flux-3-image-klein-comfy`: <https://huggingface.co/ml-resources/flux-3-image-klein-comfy>

### Fibo 2.0 파생판
- **[D35]** `akhaliq/Fibo-2.0-8step-smd`: <https://huggingface.co/akhaliq/Fibo-2.0-8step-smd>
- **[D36]** `axiomofmind/Fibo-2.0-anime-lora`: <https://huggingface.co/axiomofmind/Fibo-2.0-anime-lora>
- **[D37]** `axiomofmind/Fibo-2.0-psychedelic-lora`: <https://huggingface.co/axiomofmind/Fibo-2.0-psychedelic-lora>
- **[D38]** `Comfy-Org/Fibo-2.0` 토론 #2 "Turbo lora?": <https://huggingface.co/Comfy-Org/Fibo-2.0/discussions/2> · 커밋 기록: <https://huggingface.co/Comfy-Org/Fibo-2.0/commits/main>
- **[D39]** `lvladikov/FIBO2-Edit-Turbo-T2I`: <https://huggingface.co/lvladikov/FIBO2-Edit-Turbo-T2I>
- **[D40]** `reverentelusarca/fibo-2.0-2K-rope` (`Fibo2_turbo_edit_2K-ROPE.json`): <https://huggingface.co/reverentelusarca/fibo-2.0-2K-rope> · ComfyUI `ScaleROPE` 노드: <https://github.com/Comfy-Org/ComfyUI/blob/master/comfy_extras/nodes_rope.py>
- **[D41]** `ml-resources/Fibo-2.0-dev`: <https://huggingface.co/ml-resources/Fibo-2.0-dev>
- **[D42]** `siraxe/3dhardware_fibo2`: <https://huggingface.co/siraxe/3dhardware_fibo2>
- **[D43]** Hugging Face 모델 API `filter=base_model:…`: <https://huggingface.co/api/models?filter=base_model:briaai/Fibo-2.0-dev&limit=100> (동일 형식으로 `briaai/Fibo-2.0-edit-turbo`, `Comfy-Org/Fibo-2.0`) · `search=fibo`: <https://huggingface.co/api/models?search=fibo&sort=createdAt&direction=-1&limit=100>
- **[D44]** ostris `ai-toolkit` — `fibo2` 아키텍처: <https://github.com/ostris/ai-toolkit/tree/main/extensions_built_in/diffusion_models/fibo2>
- **[D45]** `Buattensorart2/ostris_fibo_loras_nami` 학습 설정: <https://huggingface.co/Buattensorart2/ostris_fibo_loras_nami/blob/main/nami_fibo_lokr_v1/config.yaml>

### Civitai
- **[D30]** Civitai API 질의 (전부 `sort=Most Downloaded`):
  - `baseModels=Flux.3 Klein` — <https://civitai.com/api/v1/models?baseModels=Flux.3%20Klein&sort=Most%20Downloaded&limit=10>
  - `baseModels=Flux.3 Klein&types=LORA` — <https://civitai.com/api/v1/models?baseModels=Flux.3%20Klein&types=LORA&sort=Most%20Downloaded&limit=20>
  - `baseModels=Flux.3 Klein&types=Checkpoint` — <https://civitai.com/api/v1/models?baseModels=Flux.3%20Klein&types=Checkpoint&sort=Most%20Downloaded&limit=10>
  - `baseModels=Qwen 2.1&types=LORA` — <https://civitai.com/api/v1/models?baseModels=Qwen%202.1&types=LORA&sort=Most%20Downloaded&limit=20>
  - `baseModels=Qwen 2.1&types=Checkpoint` — <https://civitai.com/api/v1/models?baseModels=Qwen%202.1&types=Checkpoint&sort=Most%20Downloaded&limit=10>
  - `baseModels=MOSS Image&types=LORA` — <https://civitai.com/api/v1/models?baseModels=MOSS%20Image&types=LORA&sort=Most%20Downloaded&limit=20>
  - `baseModels=MOSS Image&types=Checkpoint` — <https://civitai.com/api/v1/models?baseModels=MOSS%20Image&types=Checkpoint&sort=Most%20Downloaded&limit=10>
  - `query=klein` / `query=flux.3` / `query=qwen image 2.1` / `query=moss image`
  - `query=fibo` — <https://civitai.com/api/v1/models?query=fibo&limit=30&sort=Most%20Downloaded&nsfw=true>
  - `baseModels=Fibo 2.0` / `Fibo` / `FIBO 2.0` / `Bria Fibo` — 모두 0건 (Fibo 용 baseModel 값 없음)
- **[D31]** Civitai `MoreReal` (id 2904424, 제작자 NO8D): <https://civitai.com/api/v1/models?query=MoreReal&baseModels=Flux.3%20Klein&limit=3>
- **[D33]** Civitai 개발자 문서 — Klein LoRA 학습 레시피: <https://developer.civitai.com/orchestration/recipes/training-flux2-klein>
- **[D34]** BFL 문서 — FLUX.2 klein 파인튜닝 가이드: <https://docs.bfl.ai/flux_2/flux2_klein_training>

### 메타
- **[D32]** Hugging Face 모델 검색 API (`sort=downloads&direction=-1`): <https://huggingface.co/api/models?search=flux-3-image-klein&sort=downloads&direction=-1&limit=40> (동일 형식으로 `Qwen-Image-2.1`, `MOSS-Image` 질의)
- 선행 문서: [`local-image-models-research.md`](./local-image-models-research.md)
