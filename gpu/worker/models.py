"""모델 표. 값은 앱 src/lib/gpu/models.ts 와 같아야 한다(tests/imagen-local/support/model-table.json 으로 양쪽을 비교)."""

from dataclasses import dataclass
from typing import Literal

MODEL_IDS = ("klein", "qwen-turbo", "moss")

# Qwen 투명 배경: 프롬프트 앞에 붙이는 문장
TRANSPARENT_PROMPT_PREFIX = "This is an RGBA image with transparency. "


@dataclass(frozen=True)
class ModelFile:
    repo_id: str
    filename: str
    # Volume(/models) 안에 둘 경로. 없으면 리포 안 경로를 그대로 쓴다
    local_path: str | None = None

    @property
    def path(self) -> str:
        return self.local_path or self.filename


@dataclass(frozen=True)
class ModelSpec:
    id: str
    steps: int
    can_edit: bool
    supports_transparent: bool
    workflow_generate: str
    workflow_edit: str | None
    files: tuple[ModelFile, ...]

    def workflow(self, kind: Literal["generate", "edit"]) -> str:
        if kind == "generate":
            return self.workflow_generate
        if self.workflow_edit is None:
            raise ValueError(f"{self.id} 는 edit 워크플로가 없어요")
        return self.workflow_edit


_KLEIN = "black-forest-labs/flux-3-image-klein-comfy"
_QWEN = "Comfy-Org/Qwen-Image-2.1"
_MOSS = "Comfy-Org/MOSS-Image"

MODELS: dict[str, ModelSpec] = {
    "klein": ModelSpec(
        id="klein",
        steps=16,
        can_edit=True,
        supports_transparent=False,
        workflow_generate="klein-generate.json",
        workflow_edit="klein-edit.json",
        files=(
            ModelFile(_KLEIN, "diffusion_models/flux3-image-klein-int8-convrot.safetensors"),
            ModelFile(_KLEIN, "text_encoders/qwen3vl_4b_int8_convrot.safetensors"),
            ModelFile(_KLEIN, "text_encoders/qwen3.5_9b_flux3_prompt_upsampler_w4a8.safetensors"),
            ModelFile(_KLEIN, "vae/flux2-vae.safetensors"),
        ),
    ),
    "qwen-turbo": ModelSpec(
        id="qwen-turbo",
        steps=8,
        can_edit=True,
        supports_transparent=True,
        workflow_generate="qwen-turbo-generate.json",
        workflow_edit="qwen-turbo-edit.json",
        files=(
            ModelFile(_QWEN, "diffusion_models/qwen_image_2.1_turbo_int8_convrot.safetensors"),
            ModelFile(_QWEN, "text_encoders/qwen3vl_8b_int8_convrot.safetensors"),
            ModelFile(_QWEN, "vae/qwen_image_2.1_vae_bf16.safetensors"),
        ),
    ),
    "moss": ModelSpec(
        id="moss",
        steps=4,
        can_edit=False,
        supports_transparent=False,
        workflow_generate="moss-generate.json",
        workflow_edit=None,
        files=(
            ModelFile(_MOSS, "diffusion_models/moss_image_sft_bf16.safetensors"),
            ModelFile(_MOSS, "text_encoders/qwen3.5_9b_int8_convrot.safetensors"),
            ModelFile(_MOSS, "vae/flux2-vae.safetensors"),
            # 4-step LoRA: 리포의 lora.safetensors 를 ComfyUI loras/ 아래 이름으로 둔다
            ModelFile("akhaliq/MOSS-Image-SFT-4-steps", "lora.safetensors", "loras/moss_image_sft_4step_v2.0.safetensors"),
        ),
    ),
}


def all_files() -> list[ModelFile]:
    """내려받을 파일 목록. 같은 경로(공용 VAE)는 처음 나온 것 하나만 남긴다."""
    seen: set[str] = set()
    result: list[ModelFile] = []
    for spec in MODELS.values():
        for f in spec.files:
            if f.path not in seen:
                seen.add(f.path)
                result.append(f)
    return result
