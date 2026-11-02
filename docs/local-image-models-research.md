# 로컬 이미지 생성 모델 리서치 (FLUX / Qwen-Image / MOSS-Image / Fibo)

> **범위:** 소비자 GPU(Windows 11, 로컬 추론)에서 직접 돌릴 수 있는 **오픈 웨이트 체크포인트**. 클라우드 서비스·플러그인 비교는 [`image-generation-tools-research.md`](../../../docs/research/image-generation-tools-research.md) 를 본다.
> **전제:** 라이선스는 다운로드 가능 여부만 따진다. 상업적 사용 가능 여부는 참고로만 적는다.

---

## 목차

1. [핵심 추천](#1-핵심-추천)
2. [VRAM 구간별 선택](#2-vram-구간별-선택)
3. [FLUX 계열 상세](#3-flux-계열-상세)
4. [Qwen-Image 계열 상세](#4-qwen-image-계열-상세)
5. [MOSS-Image 계열 상세](#5-moss-image-계열-상세)
6. [Fibo 계열 상세](#6-fibo-계열-상세)
7. [4계열 교차 비교](#7-4계열-교차-비교)
8. [다운로드 명령](#8-다운로드-명령)
9. [확인 불가 항목](#9-확인-불가-항목)
10. [출처 목록](#10-출처-목록)

---

## 1. 핵심 추천

| 계열 | 받을 것 (리포 ID) | 한 줄 이유 |
| --- | --- | --- |
| **FLUX** | `black-forest-labs/flux-3-image-klein-comfy` | FLUX 3 Image Klein(5.6B, 2026-10-15). 오픈 웨이트 T2I 리더보드 1위이고 int8 빌드가 8GB GPU에서 돈다. ComfyUI용으로 묶인 리포라 파일 배치가 그대로 맞는다. [S5][S6][S12][S19] |
| **Qwen-Image** | `Qwen/Qwen-Image-2.1-Turbo` | Qwen-Image-2.1 의 8-step 증류판(2026-10-09). 편집 능력이 오픈 웨이트 중 최상위권이고 스텝이 1/5라 로컬에서 쓸 만하다. 품질 최우선이면 `Qwen/Qwen-Image-2.1`. [S13][S14][S16][S20] |
| **MOSS-Image** | `OpenMOSS-Team/MOSS-Image-SFT` | 실존한다. OpenMOSS(MOSI.AI) 5B DiT, 2026-10-16 공개, **Apache-2.0**. 긴 텍스트 렌더링 LLTB 96.3 으로 오픈 웨이트 1위. 단 **T2I 전용**이고 편집 불가. [S21][S22][S23] |
| **Fibo** | `briaai/Fibo-2.0-dev` | Bria 8B, 2026-10-18 공개. 생성·편집을 웨이트 하나로 하고 AA 오픈 웨이트 **편집 1위**(1088), T2I 3위(1039). 빠르게 쓰려면 4-step `briaai/Fibo-2.0-edit-turbo`(이미지 없이 돌리면 T2I 도 된다). **CC BY-NC 4.0** 이고 원본은 gated 지만, ComfyUI 재패키지 `Comfy-Org/Fibo-2.0` 은 승인 없이 받는다. [S19][S20][S30][S31][S32] |

**왜 FLUX 3 Image Klein 인가**
- BFL 공식: FLUX.2 [klein] 9B 대비 파라미터 38% 적으면서 T2I +91 Elo, 편집 +70 Elo. [S6]
- Artificial Analysis 오픈 웨이트 T2I 보드 1위(1043). 단 2위 Qwen-Image-2.1(1042)과 신뢰구간이 겹쳐 사실상 동률이다. [S19]
- INT8 빌드 기준 RTX 3070(8GB)에서 동작, RTX 4070에서 1MP 9초 미만. [S6]

**왜 Qwen-Image-2.1-Turbo 를 따로 두나**
- 편집(I+T→I)에서는 Klein보다 앞선다. AA 편집 보드 오픈 웨이트 Qwen 1081 vs Klein 1072. [S20]
- 레퍼런스 10장, 네이티브 RGBA(투명 배경), 마스크·동그라미 표시로 국소 편집 같은 기능이 Klein에 없다. [S14]
- Turbo는 8 스텝 / CFG 1 고정 스케줄이라 로컬 반복 작업에 현실적이다. [S13]

**왜 Fibo 2.0 을 따로 두나**
- 편집(I+T→I) 오픈 웨이트 1위. AA 편집 보드 Fibo 1088 vs Qwen 1081 vs Klein 1072. 단 Qwen 과는 신뢰구간(±14 / ±13)이 겹친다. [S20]
- T2I 는 3위(1039)지만 Klein·Qwen 과 신뢰구간(±12)이 겹쳐 사실상 3강 동률이다. [S19]
- 장면을 1,000단어가 넘는 JSON 캡션(VGL)으로 기술하도록 학습됐다. ComfyUI 공식 템플릿은 로컬 Qwen3-VL 8B 로 지시문을 이 형식으로 바꿔 넣어서 API 키가 필요 없다. [S30][S38]
- 학습 데이터를 Bria 가 라이선스한 약 10억 장으로 밝힌다. [S30]

**4계열을 한 번에 깔 수 없다면**
FLUX 3 Image Klein 하나로 T2I + 편집 + 멀티레퍼런스를 다 쓸 수 있다. 여기에 **이미지 안에 한국어/중국어 장문을 넣어야 하면** MOSS-Image 를, **정밀 편집·투명 배경이 필요하면** Qwen-Image-2.1-Turbo 를, **편집 결과 품질이 최우선이면** Fibo 2.0 을 추가한다.

---

## 2. VRAM 구간별 선택

| VRAM | 1순위 | 대안 | 비고 |
| --- | --- | --- | --- |
| **8GB** | FLUX 3 Klein distilled **int8** (`flux3-image-klein-int8-convrot.safetensors`) | MOSS-Image GGUF `UD-Q4_K_XL`(3.42GB) / Qwen FP8 + CPU 오프로드 | BFL 공식이 8GB RTX 3070 동작을 명시. [S6] Qwen은 FP8+오프로드로 6GB도 되지만 2배 미만 느려짐. [S17] |
| **12GB** | FLUX 3 Klein int8 (transformer 5.8GB) + 텍스트 인코더 int8 | Qwen-Image-2.1 GGUF `Q4_K_M` / MOSS int8 (5.41GB) / Fibo GGUF `Q4_0` (6.59GB) | Unsloth는 Qwen 12~16GB 구간에 GGUF Q4_K_M @1024 를 권장. [S17] |
| **16GB** | FLUX 3 Klein bf16 생성기(11.2GB) + int8 인코더 | Qwen GGUF `Q5_K_M`~`Q6_K` / MOSS `Q8_0`(5.48GB) / Fibo int8 (8.41GB) | BFL 공식 생성기 단독 소요는 bf16 11.2GB / fp8 5.6GB. [S6] |
| **24GB+** | FLUX 3 Klein bf16 전체 + bf16 prompt upsampler | Qwen-Image-2.1 FP8/INT8 (7.1~7.3GB) / MOSS bf16 (10.2GB) / Fibo bf16 (16.45GB) | ComfyUI 공식 문서가 24GB 초과일 때 bf16 빌드 전환을 권장. [S12] Unsloth는 24GB 이상에 FP8 권장. [S17] |

> 숫자 주의: BFL 모델 카드의 "B200 peak 31GB(BF16)" 는 **텍스트 인코더·prompt upsampler까지 포함한 파이프라인 전체 피크**다. 공식 블로그의 11.2GB 는 **생성기(transformer) 단독** 수치다. ComfyUI 템플릿은 int8 빌드를 기본으로 써서 이 차이를 피한다. [S5][S6][S12]

> Fibo 2.0 은 공식 VRAM 수치가 없어 생성기 파일 크기만 적었다. 인코더 Qwen3-VL-4B(int8 4.86GB / bf16 8.88GB)는 따로 들고, ComfyUI 템플릿의 프롬프트 보강을 켜면 Qwen3-VL 8B int8(9.35GB)도 메모리에 올라간다. [S32][S34][S38]

---

## 3. FLUX 계열 상세

### 3.1 버전 계보

| 모델 | 공개 | 리포 ID | 파라미터 | 라이선스 | 상태 |
| --- | --- | --- | --- | --- | --- |
| FLUX.1 Kontext [dev] | 2025 | `black-forest-labs/FLUX.1-Kontext-dev` | 12B | 비상업 (명칭 미확인) | 편집 전용, 구세대 |
| FLUX.1 Krea [dev] | 2025-07 | `black-forest-labs/FLUX.1-Krea-dev` | 12B | 비상업 (명칭 미확인) | T2I 미감 튜닝판 |
| FLUX.2 [pro]/[flex] | 2025-11-25 | — | — | API 전용 | 웨이트 없음 |
| FLUX.2 [dev] | 2025-11 | `black-forest-labs/FLUX.2-dev` | 32B | FLUX.2-dev non-commercial | 오픈 웨이트지만 32B라 소비자 GPU에 무겁다 |
| FLUX.2 [max] | 2025-12-16 | — | — | API 전용 | 웨이트 없음 |
| FLUX.2 [klein] 4B | 2026-01-15 | `black-forest-labs/FLUX.2-klein-4B` | 4B | **Apache-2.0** | 제약 없는 라이선스가 필요할 때의 유일한 FLUX 선택지 |
| FLUX.2 [klein] 9B | 2026-01-15 | `black-forest-labs/FLUX.2-klein-9B` | 9B | FLUX Non-Commercial | Klein 3에 성능으로 밀림 |
| FLUX 3 Image | 2026-10-01 | — | — | API 전용 | 바운딩박스·레퍼런스 10장·4K |
| **FLUX 3 Image Klein** | **2026-10-15** | `black-forest-labs/flux-3-image-klein` | **5.6B** | FLUX Kommunity v1.0 | **현재 최적** |
| FLUX 3 (base) | — | — | — | — | 오픈 웨이트 미공개, 로드맵에만 존재 |

[S1][S2][S4][S5][S6]

### 3.2 FLUX 3 Image Klein 구성 파일

| 역할 | 리포 ID | 비고 |
| --- | --- | --- |
| 증류판 (16 step, guidance 없음) | `black-forest-labs/flux-3-image-klein` | **gated** — HF에서 약관 동의 필요 |
| 베이스판 (50 step, guidance 3.5) | `black-forest-labs/flux-3-image-klein-base` | **gated** / 파인튜닝·LoRA 학습용 |
| ComfyUI 패키지 (bf16·int8·nvfp4 전부) | `black-forest-labs/flux-3-image-klein-comfy` | **gated** / 폴더 구조가 ComfyUI에 맞춰져 있음 |
| Prompt upsampler (9B) | `black-forest-labs/flux-3-image-klein-pup` | 모델 카드가 **"upsampler 없이 쓰지 말라"**고 명시 |
| 텍스트 인코더 | Qwen3-VL-4B-Instruct | Apache-2.0, transformer와 별도 |
| 추론 코드 | `github.com/black-forest-labs/flux-3-image-klein` | — |

[S5][S6][S7]

### 3.3 사양

- **아키텍처:** 5.6B transformer + Qwen3-VL-4B-Instruct 인코더. BFL은 계열을 flow matching transformer 로 설명한다. [S5][S3]
- **기능:** T2I, 편집, **레퍼런스 최대 10장**, 네이티브 4K, 0~1000 그리드 바운딩박스로 배치 지정(하드 마스크는 아님). [S5][S6]
- **속도:** API 중앙값 1MP T2I 4.54초 / 편집 7.18초. 로컬 int8 증류판은 RTX 5090 약 4초, RTX 4070 9초 미만. [S6]
- **약점:** 모델 카드가 **텍스트 렌더링 부정확**과 **짧은 프롬프트에서 일반적인 결과**를 명시적 한계로 적는다. [S5]
- **라이선스:** FLUX Kommunity License v1.0 — 비상업 사용 자유, 연 매출 500만 USD 미만이면 상업적 생성물까지 무료. 그 이상은 별도 상업 라이선스. **LoRA·파인튜닝 파생물도 같은 라이선스로 공유해야 한다.** [S5][S6][S18]

### 3.4 경량화 변종

| 방식 | 리포 | 비고 |
| --- | --- | --- |
| 공식 int8 / fp8 / NVFP4 | `black-forest-labs/flux-3-image-klein-comfy` | ComfyUI 템플릿 기본값이 int8 |
| GGUF | `AtomicChat/FLUX-3-Image-Klein-GGUF` | Q8_0 5.99GB / AD-Q5_K 4.44GB(권장) / AD-Q4_K 3.65GB. 텍스트 인코더 GGUF는 **쓰지 말 것**(샘플러 shape 오류) [S9] |
| GGUF (대안) | `Abiray/flux-3-image-klein-sd-GGUF`, `realrebelai/FLUX-3-Image-Klein_GGUFs` | 1.99GB(Q2_K)~5.99GB(Q8_0) [S8] |
| Nunchaku SVDQuant | **확인 불가** | ComfyUI-nunchaku 릴리스 노트에서 FLUX 3 Klein 빌드를 찾지 못했다 [S8] |

### 3.5 ComfyUI

- **ComfyUI 0.41.0(2026-10-15) 부터 네이티브 지원**, 0.41.1 백포트. 플러그인 불필요. [S12]
- 공식 템플릿 4개: `FLUX 3 Image Klein: Text to Image` / `… Distilled: Text to Image` / `… : Image Edit` / `… Distilled: Image Edit`. [S12]
- 파일 배치:

| 파일 | 폴더 |
| --- | --- |
| `flux3-image-klein-base-int8-convrot.safetensors` | `models/diffusion_models/` |
| `flux3-image-klein-int8-convrot.safetensors` | `models/diffusion_models/` |
| `qwen3vl_4b_int8_convrot.safetensors` | `models/text_encoders/` (CLIPLoader type `flux3`) |
| `qwen3.5_9b_flux3_prompt_upsampler_w4a8.safetensors` | `models/text_encoders/` |
| `flux2-vae.safetensors` | `models/vae/` |

- 멀티레퍼런스 편집은 `Set Reference Multi Latent` 노드를 거치고, 프롬프트에서 `<ref_image_0>`, `<ref_image_1>` 로 지칭한다. 증류판 편집 템플릿은 레퍼런스 1장만 쓴다. [S12]

---

## 4. Qwen-Image 계열 상세

### 4.1 버전 계보

| 모델 | HF 업데이트 | 리포 ID | 라이선스 | 상태 |
| --- | --- | --- | --- | --- |
| Qwen-Image | 2025-08-18 | `Qwen/Qwen-Image` | Apache-2.0 | 20B 초대형, 텍스트 렌더링으로 유명 |
| Qwen-Image-Edit | 2025-08-25 | `Qwen/Qwen-Image-Edit` | Apache-2.0 | 편집 1세대 |
| Qwen-Image-Edit-2509 | 2025-09-22 | `Qwen/Qwen-Image-Edit-2509` | Apache-2.0 | 편집 스냅샷 |
| Qwen-Image-Layered | 2025-12-19 | `Qwen/Qwen-Image-Layered` | Apache-2.0 | 레이어 생성 |
| **Qwen-Image-Edit-2511** | 2025-12-23 | `Qwen/Qwen-Image-Edit-2511` | Apache-2.0 | **Edit 계보의 마지막 스냅샷** |
| Qwen-Image-2512 | 2025-12-31 | `Qwen/Qwen-Image-2512` | Apache-2.0 | T2I 스냅샷 |
| Qwen-Image 2.0 / 2.0 Pro | 2026-02 | — | — | **API 전용, 웨이트 없음** |
| Qwen-Image 3.0 / 3.0 Pro | 2026-07~08 | — | — | **API 전용, 웨이트 없음** |
| **Qwen-Image-2.1** | **2026-09-20** | `Qwen/Qwen-Image-2.1` | Qwen Research License | **생성 + 편집 통합** |
| **Qwen-Image-2.1-Turbo** | **2026-10-09** | `Qwen/Qwen-Image-2.1-Turbo` | Qwen Research License | 8-step 증류판 |
| Qwen-Image-2.1-PE-T2I / -PE-I2I | 2026-09-20 | `Qwen/Qwen-Image-2.1-PE-T2I`, `…-PE-I2I` | — | 프롬프트 리라이터 |

[S14][S15][S16]

> 버전 번호가 혼란스럽다. **3.0 이 2.1 보다 오래됐고 웨이트가 없다.** 2.1 이 최신 오픈 웨이트다. Edit 전용 계보는 2511 에서 멈췄고, 편집 기능은 2.1 의 통합 모델로 흡수됐다. [S15][S16]

### 4.2 사양 (Qwen-Image-2.1)

- **파라미터:** 시각 생성부 약 7B, **32층 single-stream DiT**. (MMDiT 아님) [S14][S16]
- **어텐션:** block-causal — 텍스트는 토큰 단위 causal, 이미지는 chunk 단위 bidirectional. 조건 이미지·텍스트에 prefix KV cache 재사용. [S16]
- **텍스트 인코더:** Qwen3-VL 8B (조건 이미지도 이 인코더가 처리). **VAE:** 64채널 RGBA 오토인코더, 16× 공간 압축. [S16]
- **스케줄러:** Flow Matching + Euler discrete + dynamic shifting. [S16]
- **기능:** T2I + 편집 통합 / 레퍼런스 **최대 10장** / **네이티브 RGBA 투명 출력** / 동그라미·페인트·마스크로 국소 편집 / 인물·제품 아이덴티티 보존 / **네이티브 2K**(기본 2048×2048, 기본 40 스텝). [S14][S16]
- **Turbo 차이:** 8 denoising step, CFG 1 기본, 체크포인트에 스케줄이 내장되어 `num_inference_steps` 로 덮어쓰이지 않는다. KV 캐시 지원. [S13]
- **라이선스:** Qwen Research License Agreement — **비상업 연구·평가 한정**, 상업 사용은 별도 계약. 2512 이전 세대의 Apache-2.0 이 아니다. 다운로드 자체에 gated 승인은 없다. [S14][S16]

### 4.3 경량화 변종

| 방식 | 리포 | 수치 |
| --- | --- | --- |
| FP8 / INT8 | `unsloth/Qwen-Image-2.1-FP8`, `unsloth/Qwen-Image-2.1-Turbo-FP8` | bf16 transformer 14.2GB → 7.1~7.3GB [S10][S17] |
| GGUF | `unsloth/Qwen-Image-2.1-GGUF`, `unsloth/Qwen-Image-2.1-Turbo-GGUF`, `leejet/Qwen-Image-2.1-GGUF`, `AtomicChat/Qwen-Image-2.1-Turbo-GGUF` | Q4_K_M 약 4.2~4.6GB (리포마다 다름) [S10] |
| 공식 int8_convrot | `Comfy-Org/Qwen-Image-2.1` | ComfyUI 템플릿 기본값 [S11] |
| Lightning LoRA (lightx2v, 비공식) | — | 베이스 모델 4 스텝 [S11] |

> `leejet` GGUF는 **city96 판이 아니라 leejet 판 ComfyUI-GGUF** 를 요구한다. 오래된 city96 설치에서는 "Unknown model architecture" 오류가 난다. [S10]
> Nunchaku SVDQuant 는 Qwen-Image 1.0 / Edit-2509 까지만 확인되고 **2.1 빌드는 확인 불가**다. [S10]

### 4.4 ComfyUI

- 네이티브 지원. 공식 파일은 `Comfy-Org/Qwen-Image-2.1` (ModelScope에도 동일 미러). [S11][S16][S10]
- 템플릿 5개: Text to Image / Image Edit / Remove Background / Turbo: Text to Image / Turbo: Image Edit. [S11]
- 샘플러 기본값: **베이스 25 step, cfg 1, euler, simple** / **Turbo 8 step, cfg 1, euler, 고정 ManualSigmas**. [S11]
- 파일 배치:

| 파일 | 폴더 |
| --- | --- |
| `qwen_image_2.1_int8_convrot.safetensors` / `qwen_image_2.1_bf16.safetensors` | `models/diffusion_models/` |
| `qwen_image_2.1_turbo_int8_convrot.safetensors` / `…_turbo_bf16.safetensors` | `models/diffusion_models/` |
| `qwen3vl_8b_int8_convrot.safetensors` | `models/text_encoders/` |
| `qwen3.5_9b_qwen_image_2.1_pe_t2i.int8_convrot.safetensors` | `models/text_encoders/` |
| `qwen3.5_9b_qwen_image_2.1_pe_i2i.int8_convrot.safetensors` | `models/text_encoders/` |
| `qwen_image_2.1_vae_bf16.safetensors` | `models/vae/` |

- 메모리 조절: KV cache 노드의 `dtype` 을 `int8` 로 두면 캐시가 절반(bf16 정확도 수준), `int4` 는 1/4이지만 스텝당 오차가 약 2배. 캔버스 크기가 비용을 지배한다 — RTX 5090 기준 3000×4000 편집 약 6 s/it vs 1024 해상도 약 0.3 s/it. [S11]

---

## 5. MOSS-Image 계열 상세

### 5.1 실체 확인

실존하는 모델이다. **OpenMOSS / MOSI.AI** 가 2026-10-16 에 공개했고, 기술 보고서는 arXiv:2610.23374 (2026-10-19)다. [S21][S22][S23]

| 항목 | 내용 |
| --- | --- |
| 개발 주체 | OpenMOSS / MOSI.AI (기술 보고서 저자는 MOSI.AI 로만 표기) |
| 공개일 | 2026-10-16 (Base·SFT 동시) |
| 파라미터 | 약 5B |
| 아키텍처 | **single-stream DiT**, 처음부터 학습 (from scratch) |
| 텍스트 인코더 | **Qwen3.5-9B** |
| VAE | **FLUX.2 VAE** |
| 학습 해상도 / 컨텍스트 | 1024², 4096 토큰 (프롬프트 약 4K 토큰까지) |
| 라이선스 | **Apache-2.0** (Base·SFT 체크포인트) |
| gated | 아님 |
| 과업 | **T2I 전용 — 레퍼런스 이미지 입력·네이티브 편집 없음** |

[S21][S22][S23]

### 5.2 리포 ID

| 용도 | Hugging Face | ModelScope |
| --- | --- | --- |
| Base (사전학습) | `OpenMOSS-Team/MOSS-Image-Base` | `openmoss/MOSS-Image-Base` |
| SFT (권장) | `OpenMOSS-Team/MOSS-Image-SFT` | `openmoss/MOSS-Image-SFT` |
| ComfyUI 패키지 | `Comfy-Org/MOSS-Image` | — |
| 데모 Space | `OpenMOSS-Team/MOSS-Image` | — |
| 코드 | `github.com/OpenMOSS/MOSS-Image` | — |

[S22]

### 5.3 벤치마크

| 벤치마크 | 점수 | 맥락 |
| --- | --- | --- |
| LLTB Mean-6 (장문 텍스트) | **96.3** | 오픈 웨이트 1위. 영어 97.1 / 중국어 92.4 |
| 7Bench (레이아웃) | mIoU_det 0.8786 / Layout AUC 0.7031 / layout mIoU 0.6788 | — |
| RealLayoutArena (end-to-end Elo) | 1698.70, **2위** | 1위 GPT Image 2 = 1844.35 |

[S21][S23]

> Artificial Analysis T2I·편집 보드에는 MOSS-Image 가 **등재되어 있지 않다.** LMArena 에서도 확인하지 못했다. 위 수치는 전부 개발팀이 만든 벤치마크(LLTB, RealLayoutArena 모두 이 보고서가 신설)라는 점을 감안해야 한다. [S19][S20][S23]

### 5.4 차별점 — 레이아웃 JSON

프롬프트 자리에 JSON 레이아웃을 넣어 캔버스·텍스트·오브젝트·바운딩박스를 지정한다. 박스는 중심 기준 픽셀 좌표계의 `yxyx` 형식이다. 자연어 프롬프트와 JSON이 같은 텍스트 조건 경로를 탄다. 선택적 Prompt Enhancement 모듈이 짧은 요청을 내용·레이아웃 명세로 확장한다. [S21][S22]

**주의:** 이미지에 넣을 텍스트는 프롬프트에 **따옴표로 그대로 적어야** 한다. 안 그러면 깨진 글자가 나온다. [S24]

### 5.5 경량화 변종 / 실행

| 방식 | 리포 | 수치 |
| --- | --- | --- |
| 공식 int8_convrot | `Comfy-Org/MOSS-Image` | Base·SFT 각 **5.41GB** (bf16 은 각 10.2GB) [S25] |
| GGUF (SFT) | `unsloth/MOSS-Image-SFT-GGUF` | 추천 모델인 SFT 의 GGUF. 파일명 패턴은 `MOSS-Image-SFT-{Q4_K_M,Q8_0,UD-Q3_K_XL,UD-Q4_K_XL,UD-Q5_K_XL,UD-Q6_K_XL,BF16}.gguf` [S29] |
| GGUF (Base) | `unsloth/MOSS-Image-Base-GGUF` | UD-Q4_K_XL 3.42GB(권장) / UD-Q5_K_XL 3.95GB / UD-Q6_K_XL 4.53GB / Q8_0 5.48GB / BF16 10.17GB. 양자화 단계별 용량은 Base 기준 수치다 [S26] |
| FP16 수정판 | `KBlueLeaf/MOSS-Image-FP16-fixed` | 커뮤니티 [S22] |
| 8-step DMD 증류 LoRA | lodestones | 커뮤니티 [S22] |
| LoRA 학습 | KohakuMossTrainer (2026-10-18) | **6GB VRAM 에서 어댑터 학습 가능** [S22] |

- **ComfyUI:** master/nightly 에 PR 17095 로 네이티브 반영, **0.42.0 이상** 필요. 플러그인 불필요. [S22][S27]
- 파일 배치: `moss_image_sft_int8_convrot.safetensors` → `models/diffusion_models/`, `qwen3.5_9b_w4a8_gptq.safetensors` → `models/text_encoders/` (CLIPLoader type `moss_image`), `flux2-vae_small.safetensors` → `models/vae/`. [S27]
- 템플릿 4개: T2I(SFT/Base) + Layout-Guided T2I(SFT/Base). [S27]
- 기본 샘플링: flow matching Euler, **50 step, CFG 3, shift 5**, layer 22 에서 negative branch skip. [S22]

---

## 6. Fibo 계열 상세

### 6.1 버전 계보

| 모델 | HF 등록 | 리포 ID | 라이선스 | 상태 |
| --- | --- | --- | --- | --- |
| FIBO | 2025-10-09 | `briaai/FIBO` | bria-fibo (CC BY-NC 4.0) | 8B, T2I 전용, 50 step. 인코더 SmolLM3-3B + Wan 2.2 VAE |
| Fibo-lite | 2025-11-27 | `briaai/Fibo-lite` | CC BY-NC 4.0 | 세부 미확인 |
| Fibo-Edit | 2026-01-04 | `briaai/Fibo-Edit` | — | 편집 1세대 |
| Fibo-1.5 | 2026-07-13 | `briaai/Fibo-1.5` | bria-fibo (CC BY-NC 4.0) | FIBO 의 DMD 증류판. 4~6 step, CFG 없음 |
| Fibo-Edit-1.5 | 2026-08-10 | `briaai/Fibo-Edit-1.5-base`, `…-turbo` | — | 편집 1.5 (base / turbo) |
| **Fibo 2.0 dev** | **2026-10-18** | `briaai/Fibo-2.0-dev` | CC BY-NC 4.0 | **생성 + 편집 통합** |
| **Fibo 2.0 Edit Turbo** | **2026-10-19** | `briaai/Fibo-2.0-edit-turbo` | CC BY-NC 4.0 | 4-step 편집 전용 증류판 |

[S30][S31][S37]

> 1.x 와 2.0 은 인코더(SmolLM3-3B vs Qwen3-VL-4B)와 VAE(Wan 2.2 vs FLUX.2)가 다르다. [S30][S37]

### 6.2 사양 (Fibo 2.0)

- **아키텍처:** 8B flow matching. 이미지 토큰은 **44블록 single-stream DiT** 가 처리하고, 2층 Perceiver resampler 가 VLM 출력을 256~512개 gist 토큰으로 압축해 넘긴다. 이 중 5개 블록은 VLM 내부 특징을 cross-attention 으로 따로 받는다. [S30]
- **텍스트 인코더:** Qwen3-VL-4B-Instruct(FLUX 3 Klein 과 같은 모델). 편집 입력 이미지는 VLM 과 VAE 양쪽으로 인코딩된다. **VAE:** FLUX.2 VAE. [S30]
- **기능:** T2I / 지시 편집 / 마스크 편집(흰 영역만 재생성) / **레퍼런스 최대 4장** / Inspire(레퍼런스 유도 생성) / 사진 스타일 모드 5종. 레퍼런스 수는 diffusers 기준이고, ComfyUI `TextEncodeFibo2` 는 이미지 입력을 16장까지 받는다. 멀티턴 편집·배경 제거·제품샷·마스크 지우기·아웃페인팅은 모델 카드에 "coming soon" 으로만 있다. [S30][S31][S33]
- **해상도:** 약 1MP 로 학습, 가로세로 16의 배수(예: 1024×1024, 1424×800, 1248×832). 최대 해상도는 명시가 없다. [S30]
- **스텝:** dev **50 step, guidance 5.0** / Edit Turbo **4 step, guidance 1.0**(negative prompt 무시). [S30][S31]
- **텍스트 렌더링:** 파이프라인에 폰트 파일(`fonts` 인자)을 넘기면 모델이 렌더링된 글자를 참고한다. 개선을 주장하지만 정량 벤치마크는 없다. [S30][S31]
- **학습 데이터:** Bria 가 라이선스한 약 10억 장과 긴 구조화 캡션. [S30]
- **diffusers:** `BriaFibo2Pipeline`, `diffusers>=0.42.0`. [S30][S31]
- **Edit Turbo:** 모델 카드는 편집 전용으로 소개하지만, 이미지 없이 호출하면 4-step T2I 도 된다(커뮤니티 확인, [파생판 문서 §5.3](./local-image-model-derivatives.md#53-평가-좋은-것)). 파인튜닝은 dev 에서 시작하라고 카드가 명시한다. [S31]
- **라이선스:** CC BY-NC 4.0 — **비상업 한정**, 상업 사용은 Bria 와 별도 계약. 원본 리포는 **gated**(폼 제출). `Comfy-Org/Fibo-2.0` 재패키지는 gated 가 아니지만(HF API `gated: false`) 라이선스는 같다. [S30][S31][S32]

### 6.3 차별점 — VGL 구조화 프롬프트

Bria 의 Visual GenAI Language(VGL)는 장면을 1,000단어가 넘는 JSON 캡션으로 기술한다. Fibo 2.0 은 이 형식의 캡션으로 학습됐다. 짧은 지시문을 VGL 로 바꾸는 방법은 경로마다 다르다. [S30]

| 경로 | 변환 방법 |
| --- | --- |
| diffusers | `bria-vgl` 패키지. **Gemini API 키 필요** [S30][S31] |
| ComfyUI 공식 템플릿 | `TextGenerate` 노드가 **로컬 Qwen3-VL 8B int8** 로 레퍼런스 이미지를 읽고 지시문을 구조화 캡션으로 다시 쓴다. API 키 불필요. 끄면 원문 프롬프트가 그대로 들어간다 [S38] |

- `TextEncodeFibo2` 노드는 평문과 JSON 캡션을 둘 다 받는다. 이미지를 연결하면 프롬프트는 편집 지시가 되고, JSON 이면 `edit_instruction` 키에 바꿀 내용을 적는다. 이미지는 `<image_1>`, `<image_2>` 로 지칭한다. [S33]
- 변환 없이 평문을 넣을 때 품질이 얼마나 떨어지는지는 자료가 없다.

### 6.4 경량화 변종

| 방식 | 리포 | 수치 |
| --- | --- | --- |
| 공식 int8_convrot | `Comfy-Org/Fibo-2.0` | dev·Edit Turbo 각 **8.41GB** (bf16 각 16.45GB). Hadamard 회전 + 채널별 스케일, adaLN 은 bf16 유지. 원본과 출력이 약간 다르다 [S32] |
| GGUF | `realrebelai/Fibo-2.0_GGUFs` | dev·Edit Turbo 각 Q4_0 6.59GB / Q5_0 7.45GB / Q8_0 10.02GB. ComfyUI-GGUF(city96) 로더 필요, GGUF 워크플로 JSON 포함 [S34] |
| GGUF (대안) | `molbal/fibo-2.0-GGUF`, `vantagewithai/Fibo-2.0-Dev-and-Edit-Turbo-ComfyUI-GGUF`, `Abiray/Fibo-2.0-edit-turbo-GGUF` | 용량 미확인 [S34] |
| NVFP4 | `BennyDaBall/Fibo-2.0-dev-NVFP4`, `BennyDaBall/Fibo-2.0-edit-turbo-NVFP4` | Blackwell(RTX 50) 대상 [S34] |
| MLX (Apple Silicon) | `mflux-community/fibo-2-0-dev-mflux-q8`, `mflux-community/fibo-2-0-edit-turbo-mflux-q4` / `-q8` | — [S34] |
| Turbo LoRA | `Comfy-Org/Fibo-2.0` 의 `loras/fibo_2.0_turbo_lora_avg_rank_270_bf16.safetensors` (1.99GB) | Edit Turbo 를 dev(non-turbo)에 얹으려고 Kijai 가 추출한 차분 LoRA. 권장 strength·step 은 미기재 [S32][S41] |

> 다운로드 수는 `Comfy-Org/Fibo-2.0` 재패키지(약 26만)가 원본 `briaai` 리포(각 약 1.9천)보다 두 자릿수 많다. 로컬 사용은 사실상 ComfyUI 재패키지로 몰린다. 파인튜닝 리포는 없고 LoRA 는 소수다 — 상세는 [파생판 문서 §5](./local-image-model-derivatives.md#5-fibo-20-파생판). [S32][S34]

### 6.5 ComfyUI

- **ComfyUI 0.43.0(2026-10-27) 부터 네이티브 지원**(PR #17240). 같은 릴리스에 RoPE 를 NTK-aware 로 바꾼 #17290 과 T2I negative prompt 처리를 고친 #17285 도 들어 있다. [S35]
- CLIPLoader type 은 **`fibo2`** 이고, ComfyUI 레시피는 FLUX 3 Klein(`flux3`)과 같은 qwen3-vl 4B 다. [S39]
- 로컬 템플릿은 2개이고 **둘 다 편집용**이다. 템플릿 하나를 받으면 약 27GB(bf16 인코더와 프롬프트 보강 LLM 포함)다. [S38]

| 템플릿 | 모델 | 샘플러 |
| --- | --- | --- |
| `Fibo 2.0 Turbo: Image Edit` | Edit Turbo int8 | 4 step, CFG 1, euler, simple |
| `Fibo 2.0 Dev: Image Edit` | dev int8 | 50 step, CFG 5, Bria 구조화 negative |

- T2I 템플릿 `Bria: FIBO 2.0 Text to Image` 는 **API 과금형 파트너 노드**다. 모델을 받지 않고 Comfy 크레딧으로 돈다. 로컬 T2I 는 `TextEncodeFibo2` 에 이미지를 연결하지 않으면 된다(이미지가 없으면 1024). [S33][S36][S38]
- 파일 배치 (템플릿 기준):

| 파일 | 폴더 |
| --- | --- |
| `fibo2_edit_turbo_int8_convrot.safetensors` / `fibo2_dev_int8_convrot.safetensors` | `models/diffusion_models/` |
| `qwen3vl_4b_bf16.safetensors` (저메모리: `qwen3vl_4b_int8_convrot.safetensors`) | `models/text_encoders/` (CLIPLoader type `fibo2`) |
| `qwen3vl_8b_int8_convrot.safetensors` (프롬프트 보강, `Comfy-Org/Qwen3-VL`) | `models/text_encoders/` (CLIPLoader type `fibo2`) |
| `flux2-vae.safetensors` | `models/vae/` |

[S32][S38]

> **다른 계열과 파일명이 겹친다.**
> - `flux2-vae.safetensors`, `qwen3vl_4b_int8_convrot.safetensors`: FLUX 3 Klein 패키지와 이름·크기가 같다. Klein 리포가 gated 라 해시는 비교하지 못했다.
> - `qwen3vl_4b_bf16.safetensors`: 이름은 같지만 **크기가 다르다**(Klein 8,875,719,408 / Fibo 8,875,719,384 바이트). 같은 폴더에 받으면 한쪽만 남는다. Fibo 쪽은 `Comfy-Org/Qwen3-VL` 의 같은 이름 파일과 SHA-256 이 같다.
> - `qwen3vl_8b_int8_convrot.safetensors`: Qwen-Image-2.1 인코더와 **SHA-256 까지 같은 파일**이라 한 번만 받으면 된다.
>
> [S32][S40]

---

## 7. 4계열 교차 비교

| 항목 | FLUX 3 Image Klein | Qwen-Image-2.1 (/Turbo) | MOSS-Image SFT | Fibo 2.0 (/Edit Turbo) |
| --- | --- | --- | --- | --- |
| 파라미터 | 5.6B | 7B (시각 생성부) | 5B | 8B |
| 아키텍처 | flow matching transformer | single-stream DiT (block-causal) | single-stream DiT | single-stream DiT 44블록 + Perceiver resampler |
| 텍스트 인코더 | Qwen3-VL-4B-Instruct | Qwen3-VL 8B | Qwen3.5-9B | Qwen3-VL-4B-Instruct |
| 공개일 | 2026-10-15 | 2026-09-20 / 10-09 | 2026-10-16 | 2026-10-18 / 10-19 |
| 라이선스 | FLUX Kommunity v1.0 (비상업 + <$5M 예외) | Qwen Research (비상업) | **Apache-2.0** | CC BY-NC 4.0 (비상업) |
| gated 승인 | **필요** | 불필요 | 불필요 | 원본 필요 / Comfy-Org 재패키지 불필요 |
| T2I | O | O | O | O (dev. Edit Turbo 도 이미지 없이 4 step) |
| 편집(I+T→I) | O (레퍼런스 10장) | **O (레퍼런스 10장 + 마스크·RGBA)** | **X** | O (레퍼런스 4장 + 마스크) |
| 텍스트 렌더링 | **약함** (모델 카드가 한계로 명시) | 강함 (중/영) | **최강** (LLTB 96.3) | 개선 주장 (폰트 파일 입력), 수치 없음 |
| 레이아웃 제어 | 바운딩박스 (soft) | 마스크·페인트 국소 편집 | **JSON 레이아웃 (yxyx bbox)** | **JSON 장면 기술 (VGL)** |
| 기본 스텝 | 16 (증류) / 50 (base) | 25 (base) / **8 (Turbo)** | **50** | 50 (dev) / **4 (Edit Turbo)** |
| 속도 | **최상** (RTX 4070 1MP <9초) | 중 (Turbo면 상) | **하** (50 step 고정) | 하 (dev) / 편집은 Turbo 4 step. 실측 수치 없음 |
| 최대 해상도 | 네이티브 4K | 네이티브 2K | 1024² 학습 | 약 1MP 학습 |
| AA 오픈웨이트 T2I Elo | **1043 (1위)** | 1042 (2위) | 미등재 | 1039 (3위) |
| AA 오픈웨이트 편집 Elo | 1072 (3위) | 1081 (2위) | 해당 없음 | **1088 (1위)** |
| 한국어 프롬프트 | 확인 불가 (인코더는 다국어 Qwen3-VL) | 확인 불가 (인코더는 다국어 Qwen3-VL) | 확인 불가 (영·중 bilingual 로만 표기) | 확인 불가 (모델 카드 언어 태그 `en` 만) |
| 이미지 내 한국어 렌더링 | **확인 불가** | **확인 불가** | **확인 불가** (벤치마크는 영·중만) | **확인 불가** |
| ComfyUI | 0.41.0+ 네이티브 | 네이티브 | 0.42.0+ 네이티브 | 0.43.0+ 네이티브 |
| GGUF | O (3개 커뮤니티 리포) | O (4개 이상) | O (unsloth) | O (커뮤니티 4개 이상) |
| Nunchaku | 확인 불가 | 확인 불가 (1.0/Edit-2509 까지만) | 확인 불가 | 확인 불가 |
| 공식 증류/Turbo | O (distilled 16 step) | **O (Turbo 8 step)** | X (커뮤니티 8-step DMD LoRA만) | O (Edit Turbo 4 step, 편집 전용) |
| LoRA 생태계 | Civitai 페이지 존재, 수량 확인 불가. 학습은 Klein **Base** 로 | Civitai LoRA 약 106개(2026-10-13 시점, 2차 출처) / HF 어댑터 162개·파인튜닝 85개 | KohakuMossTrainer 공식 제공(6GB). HF 검색 기준 서드파티 리포 30개 이상 — 애니메·투명배경·캐릭터 레퍼런스 LoRA, 4/8-step DMD 가속 어댑터, 비공식 편집 포크까지 존재 [S29] | 파인튜닝 0개, LoRA 소수(스타일 2·속도 2). 학습은 dev 로. 상세는 파생판 문서 §5 [S31] |

**한국어에 대한 정직한 정리:** 네 모델 모두 **한국어 프롬프트 이해도**나 **이미지 안 한글 렌더링**에 대한 공식 수치가 없다. MOSS-Image 는 공식 문서가 "영어·중국어 bilingual" 로만 범위를 한정하고, Fibo 2.0 은 모델 카드 언어 태그가 영어(`en`)뿐이다. FLUX 3 Klein·Qwen-Image-2.1·Fibo 2.0 은 다국어 LLM(Qwen3-VL)을 인코더로 쓰므로 **프롬프트 이해**는 기대할 만하지만, 글자 렌더링은 별개 문제이고 검증된 자료가 없다. 한글이 들어간 이미지가 목표라면 직접 시험이 필요하다.

---

## 8. 다운로드 명령

`hf` CLI 는 `huggingface_hub` 패키지에 포함된다. 문법은 `hf download REPO_ID [FILENAMES...] [OPTIONS]`. [S28]

### FLUX 3 Image Klein (ComfyUI, gated)

먼저 <https://huggingface.co/black-forest-labs/flux-3-image-klein-comfy> 에서 라이선스에 동의해야 한다. 그 다음:

```bash
# 리포 폴더 구조가 ComfyUI/models 와 같으므로 통째로 받으면 배치가 끝난다
hf download black-forest-labs/flux-3-image-klein-comfy \
  --local-dir ComfyUI/models --token=hf_****
```

필요한 파일만 받으려면:

```bash
hf download black-forest-labs/flux-3-image-klein-comfy \
  diffusion_models/flux3-image-klein-int8-convrot.safetensors \
  text_encoders/qwen3vl_4b_int8_convrot.safetensors \
  text_encoders/qwen3.5_9b_flux3_prompt_upsampler_w4a8.safetensors \
  vae/flux2-vae.safetensors \
  --local-dir ComfyUI/models --token=hf_****
```

### Qwen-Image-2.1-Turbo

```bash
# diffusers 용 원본 웨이트
hf download Qwen/Qwen-Image-2.1-Turbo --local-dir models/Qwen-Image-2.1-Turbo

# ComfyUI 용 (int8)
hf download Comfy-Org/Qwen-Image-2.1 \
  diffusion_models/qwen_image_2.1_turbo_int8_convrot.safetensors \
  text_encoders/qwen3vl_8b_int8_convrot.safetensors \
  vae/qwen_image_2.1_vae_bf16.safetensors \
  --local-dir ComfyUI/models

# 저사양: GGUF
hf download unsloth/Qwen-Image-2.1-Turbo-GGUF --include "*Q4_K_M*" \
  --local-dir ComfyUI/models/unet
```

### MOSS-Image

```bash
# ComfyUI 용 (int8)
hf download Comfy-Org/MOSS-Image \
  diffusion_models/moss_image_sft_int8_convrot.safetensors \
  text_encoders/qwen3.5_9b_w4a8_gptq.safetensors \
  vae/flux2-vae_small.safetensors \
  --local-dir ComfyUI/models

# diffusers 용 원본
hf download OpenMOSS-Team/MOSS-Image-SFT --local-dir models/MOSS-Image-SFT

# 저사양: GGUF (권장 UD-Q4_K_XL)
hf download unsloth/MOSS-Image-SFT-GGUF --include "*UD-Q4_K_XL*" \
  --local-dir ComfyUI/models/unet
```

### Fibo 2.0

```bash
# ComfyUI 용 (int8 생성기 + 템플릿 기본 bf16 인코더). Comfy-Org 재패키지는 gated 가 아니다
hf download Comfy-Org/Fibo-2.0 \
  diffusion_models/fibo2_edit_turbo_int8_convrot.safetensors \
  diffusion_models/fibo2_dev_int8_convrot.safetensors \
  text_encoders/qwen3vl_4b_bf16.safetensors \
  vae/flux2-vae.safetensors \
  --local-dir ComfyUI/models

# 템플릿의 프롬프트 보강 LLM. Qwen-Image-2.1 을 받았다면 이미 있는 파일이다
hf download Comfy-Org/Qwen3-VL text_encoders/qwen3vl_8b_int8_convrot.safetensors \
  --local-dir ComfyUI/models

# diffusers 용 원본 (gated — https://huggingface.co/briaai/Fibo-2.0-dev 에서 폼 제출 후)
hf download briaai/Fibo-2.0-dev --local-dir models/Fibo-2.0-dev --token=hf_****

# 저사양: GGUF (ComfyUI-GGUF 로더 필요)
hf download realrebelai/Fibo-2.0_GGUFs fibo2_dev-Q4_0.gguf \
  --local-dir ComfyUI/models/unet
```

### ComfyUI 모델 경로 요약

```
ComfyUI/models/
├── diffusion_models/
│   ├── flux3-image-klein-int8-convrot.safetensors
│   ├── qwen_image_2.1_turbo_int8_convrot.safetensors
│   ├── moss_image_sft_int8_convrot.safetensors
│   ├── fibo2_edit_turbo_int8_convrot.safetensors
│   └── fibo2_dev_int8_convrot.safetensors
├── text_encoders/
│   ├── qwen3vl_4b_int8_convrot.safetensors              # FLUX 3 Klein  (CLIPLoader type: flux3)
│   ├── qwen3.5_9b_flux3_prompt_upsampler_w4a8.safetensors
│   ├── qwen3vl_8b_int8_convrot.safetensors              # Qwen-Image-2.1 인코더 · Fibo 2.0 프롬프트 보강 (같은 파일)
│   ├── qwen3.5_9b_w4a8_gptq.safetensors                 # MOSS-Image    (CLIPLoader type: moss_image)
│   └── qwen3vl_4b_bf16.safetensors                      # Fibo 2.0      (CLIPLoader type: fibo2)
└── vae/
    ├── flux2-vae.safetensors                            # FLUX 3 Klein · Fibo 2.0 (이름·크기 동일)
    ├── qwen_image_2.1_vae_bf16.safetensors              # Qwen-Image-2.1
    └── flux2-vae_small.safetensors                      # MOSS-Image
```

> ComfyUI 버전: FLUX 3 Klein 은 0.41.0+, MOSS-Image 는 0.42.0+, Fibo 2.0 은 0.43.0+. 넷 다 쓰려면 0.43.0 이상으로 맞춘다. [S12][S27][S35]

---

## 9. 확인 불가 항목

사실로 쓸 수 없는 것들을 그대로 남긴다.

| 항목 | 상태 |
| --- | --- |
| 네 모델의 **한국어 프롬프트 대응 / 한글 렌더링** 수치 | 1차·2차 어디에도 자료 없음 |
| **Nunchaku SVDQuant** FLUX 3 Klein / Qwen-Image-2.1 빌드 | 검색으로 확인 못 함. Nunchaku는 Qwen-Image 1.0·Edit-2509 까지만 확인됨 |
| MOSS-Image 의 **추론 VRAM 공식 수치** | GitHub·블로그 모두 미기재. 파일 크기(int8 5.41GB, bf16 10.2GB)로만 추정 가능 |
| MOSS-Image 의 **Artificial Analysis / LMArena 순위** | 미등재 |
| **r/StableDiffusion·r/comfyui 중론** | reddit.com 이 크롤러 차단이라 직접 확인 불가. 2차 출처의 단편적 의견만 있고(Klein 편집이 Qwen보다 낫다/못하다가 갈림) 중론이라 부를 수준이 아님 |
| FLUX 3 Klein **Civitai LoRA 수량** | 집계 없음 |
| Qwen-Image-2.1 Civitai LoRA 106개 | 2026-10-13 시점 **2차 출처(블로그)** 수치. Civitai 직접 질의 결과가 아님 |
| Qwen-Image-2.1-Turbo 의 **ModelScope 리포 ID** | 공식 GitHub·X가 ModelScope 공개를 명시하나 정확한 ID는 페이지 미확인 |
| FLUX 3 (base, Klein 아닌 본체) 오픈 웨이트 | BFL이 "향후 단계"로만 언급, 날짜 없음 |
| FLUX 3 Klein 모델 카드의 "31GB peak" 와 블로그의 "11.2GB" | 측정 범위(파이프라인 전체 vs 생성기 단독)가 달라 보이나, BFL이 명시적으로 설명하지 않음 |
| Fibo 2.0 의 **추론 VRAM 공식 수치** | 모델 카드·GGUF 리포 모두 미기재. 파일 크기(int8 8.41GB, bf16 16.45GB)로만 추정 가능 |
| AA 리더보드의 Fibo 2.0 이 **dev 인지 Edit Turbo 인지** | 리더보드 표기는 "Fibo 2.0" 뿐. Edit Turbo 모델 카드도 같은 편집 1위를 인용한다 |
| Fibo 2.0 VAE·int8 인코더가 FLUX 3 Klein 패키지와 **같은 파일인지** | 이름·크기는 같다. Klein 리포가 gated 라 해시를 비교하지 못함 |
| `Comfy-Org/Fibo-2.0` turbo LoRA 의 **권장 strength·step** | 용도(Edit Turbo 를 dev 에 얹기)는 토론 #2 로 확인. 사용 설정은 어디에도 없음 |
| Fibo 2.0 에 **평문 프롬프트**를 그대로 넣을 때 VGL 대비 품질 | 자료 없음 |
| Fibo 2.0 **텍스트 렌더링** 정량 수치 | 모델 카드는 개선만 주장 |
| `TextEncodeFibo2` 노드 동작 세부 | 근거가 AI 생성으로 표기된 노드 문서뿐. 실행해서 확인 필요 |

---

## 10. 출처 목록

### FLUX
- **[S1]** Black Forest Labs — Release Notes: <https://docs.bfl.ml/release-notes>
- **[S2]** Black Forest Labs — FLUX.2 Overview: <https://docs.bfl.ml/flux_2/flux2_overview>
- **[S3]** Flux (text-to-image model), Wikipedia: <https://en.wikipedia.org/wiki/Flux_(text-to-image_model)>
- **[S4]** Hugging Face — black-forest-labs 조직 모델 목록: <https://huggingface.co/black-forest-labs/models?sort=created>
- **[S5]** 모델 카드 — `black-forest-labs/flux-3-image-klein`: <https://huggingface.co/black-forest-labs/flux-3-image-klein>
- **[S6]** BFL 블로그 — FLUX 3 Image Klein: <https://bfl.ai/blog/flux-3-image-klein>
- **[S7]** 모델 카드 — `black-forest-labs/flux-3-image-klein-base`: <https://huggingface.co/black-forest-labs/flux-3-image-klein-base>
- **[S8]** 커뮤니티 GGUF — `Abiray/flux-3-image-klein-sd-GGUF`: <https://huggingface.co/Abiray/flux-3-image-klein-sd-GGUF> / `realrebelai/FLUX-3-Image-Klein_GGUFs`: <https://huggingface.co/realrebelai/FLUX-3-Image-Klein_GGUFs> / ComfyUI-nunchaku: <https://github.com/nunchaku-ai/ComfyUI-nunchaku>
- **[S9]** 커뮤니티 GGUF — `AtomicChat/FLUX-3-Image-Klein-GGUF`: <https://huggingface.co/AtomicChat/FLUX-3-Image-Klein-GGUF>
- **[S12]** ComfyUI 공식 — FLUX 3 Image Klein 튜토리얼: <https://docs.comfy.org/tutorials/flux/flux-3-klein>
- **[S18]** Civitai — Flux.3 Klein 모델 페이지: <https://civitai.com/models/3003556/flux3-klein>

### Qwen-Image
- **[S10]** 커뮤니티 양자화 — `unsloth/Qwen-Image-2.1-GGUF`: <https://huggingface.co/unsloth/Qwen-Image-2.1-GGUF> / `leejet/Qwen-Image-2.1-GGUF`: <https://huggingface.co/leejet/Qwen-Image-2.1-GGUF> / `AtomicChat/Qwen-Image-2.1-Turbo-GGUF`: <https://huggingface.co/AtomicChat/Qwen-Image-2.1-Turbo-GGUF> / ModelScope `Comfy-Org/Qwen-Image-2.1`: <https://www.modelscope.cn/models/Comfy-Org/Qwen-Image-2.1>
- **[S11]** ComfyUI 공식 — Qwen-Image-2.1 튜토리얼: <https://docs.comfy.org/tutorials/image/qwen/qwen-image-2-1>
- **[S13]** 모델 카드 — `Qwen/Qwen-Image-2.1-Turbo`: <https://huggingface.co/Qwen/Qwen-Image-2.1-Turbo>
- **[S14]** 모델 카드 — `Qwen/Qwen-Image-2.1`: <https://huggingface.co/Qwen/Qwen-Image-2.1>
- **[S15]** Hugging Face — Qwen 조직 이미지 모델 목록: <https://huggingface.co/Qwen/models?sort=modified&search=Image>
- **[S16]** GitHub — `QwenLM/Qwen-Image-2.1` README: <https://github.com/QwenLM/Qwen-Image-2.1>
- **[S17]** Unsloth Docs — Qwen-Image-2.1 로컬 실행: <https://unsloth.ai/docs/models/qwen-image-2.1>

### MOSS-Image
- **[S21]** OpenMOSS 공식 블로그 — MOSS-Image: <https://openmoss.ai/blog/en/moss-image/>
- **[S22]** GitHub — `OpenMOSS/MOSS-Image` README: <https://github.com/OpenMOSS/MOSS-Image>
- **[S23]** arXiv:2610.23374 — MOSS-Image Technical Report: <https://arxiv.org/abs/2610.23374>
- **[S24]** `Kandoo/MOSS-Image-Impressionism-LoRA` (프롬프트 작성 주의): <https://huggingface.co/Kandoo/MOSS-Image-Impressionism-LoRA>
- **[S25]** `Comfy-Org/MOSS-Image` 파일 목록: <https://huggingface.co/Comfy-Org/MOSS-Image/tree/main/diffusion_models>
- **[S26]** `unsloth/MOSS-Image-Base-GGUF`: <https://huggingface.co/unsloth/MOSS-Image-Base-GGUF>
- **[S29]** Hugging Face 모델 검색 API `search=MOSS-Image`: <https://huggingface.co/api/models?search=MOSS-Image> · `unsloth/MOSS-Image-SFT-GGUF`: <https://huggingface.co/unsloth/MOSS-Image-SFT-GGUF>
- **[S27]** ComfyUI 공식 — MOSS-Image 튜토리얼: <https://docs.comfy.org/tutorials/image/moss-image/moss-image>

### Fibo
- **[S30]** 모델 카드 — `briaai/Fibo-2.0-dev`: <https://huggingface.co/briaai/Fibo-2.0-dev>
- **[S31]** 모델 카드 — `briaai/Fibo-2.0-edit-turbo`: <https://huggingface.co/briaai/Fibo-2.0-edit-turbo>
- **[S32]** `Comfy-Org/Fibo-2.0` 모델 카드·파일 목록: <https://huggingface.co/Comfy-Org/Fibo-2.0> · 메타데이터 API(`gated`, 다운로드 수): <https://huggingface.co/api/models/Comfy-Org/Fibo-2.0>
- **[S33]** ComfyUI 공식 — `TextEncodeFibo2` 노드 문서 (페이지에 AI 생성 문서라고 표기): <https://docs.comfy.org/built-in-nodes/TextEncodeFibo2>
- **[S34]** Hugging Face 모델 검색 API `search=fibo`: <https://huggingface.co/api/models?search=fibo&sort=downloads> · `realrebelai/Fibo-2.0_GGUFs`: <https://huggingface.co/realrebelai/Fibo-2.0_GGUFs>
- **[S35]** ComfyUI 릴리스 노트 (v0.43.0): <https://github.com/Comfy-Org/ComfyUI/releases>
- **[S36]** ComfyUI 공식 — Bria FIBO 파트너 노드: <https://docs.comfy.org/tutorials/partner-nodes/bria/fibo>
- **[S37]** 모델 카드 — `briaai/FIBO`: <https://huggingface.co/briaai/FIBO> · `briaai/Fibo-1.5`: <https://huggingface.co/briaai/Fibo-1.5> · briaai Fibo 모델 목록 API: <https://huggingface.co/api/models?author=briaai&search=fibo>
- **[S38]** ComfyUI 워크플로 템플릿 — `templates/index.json`: <https://github.com/Comfy-Org/workflow_templates/blob/main/templates/index.json> · `image_fibo2_edit_turbo_pe.json`: <https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_fibo2_edit_turbo_pe.json>
- **[S39]** ComfyUI 소스 `nodes.py` — CLIPLoader `fibo2` 타입: <https://github.com/Comfy-Org/ComfyUI/blob/master/nodes.py>
- **[S40]** 파일 크기·SHA-256 대조 (HF 트리 API): <https://huggingface.co/api/models/Comfy-Org/Qwen3-VL/tree/main/text_encoders> · <https://huggingface.co/api/models/Comfy-Org/Qwen-Image-2.1/tree/main/text_encoders> · <https://huggingface.co/api/models/black-forest-labs/flux-3-image-klein-comfy/tree/main/text_encoders>
- **[S41]** `Comfy-Org/Fibo-2.0` 토론 #2 "Turbo lora?": <https://huggingface.co/Comfy-Org/Fibo-2.0/discussions/2>

### 리더보드·도구
- **[S19]** Artificial Analysis — AA-Image-T2I v2.1 오픈 웨이트 리더보드: <https://artificialanalysis.ai/image/leaderboard/text-to-image/open-weights>
- **[S20]** Artificial Analysis — AA-Image-Editing v2.1 오픈 웨이트 리더보드: <https://artificialanalysis.ai/image/leaderboard/editing/open-weights>
- **[S28]** Hugging Face Hub — CLI 가이드 (`hf download`): <https://huggingface.co/docs/huggingface_hub/guides/cli>
