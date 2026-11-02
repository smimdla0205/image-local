"""ComfyUI API 포맷 워크플로를 읽고, 바인딩 표(bindings.json)대로 잡 값을 채운다(순수 함수).

바인딩 표: {"<워크플로>.json": {"prompt": [["<노드 id>", "<입력 이름>"], ...], "seed": [...], ...}}
"""

import copy
import json
import re
from dataclasses import dataclass
from pathlib import Path

from .models import TRANSPARENT_PROMPT_PREFIX

BINDINGS_FILE = "bindings.json"
WORKFLOW_NAME_RE = re.compile(r"[a-z0-9-]+\.json")
# 바인딩이 꼭 있어야 하는 키. width·height·steps 는 없을 수 있다(Qwen 은 ManualSigmas, 고치기는 입력 이미지 크기)
REQUIRED_KEYS = ("prompt", "seed", "filename_prefix")


class WorkflowBindingError(ValueError):
    """바인딩 표와 워크플로가 맞지 않는다."""


@dataclass(frozen=True)
class FillParams:
    prompt: str
    seed: int
    width: int
    height: int
    steps: int
    filename_prefix: str
    image: str | None = None
    transparent: bool = False


def load_workflow(name: str, workflows_dir: Path) -> dict:
    # 이름은 모델 표에서 오지만, 경로 조작이 될 수 있는 이름은 받지 않는다
    if not WORKFLOW_NAME_RE.fullmatch(name):
        raise ValueError(f"워크플로 이름이 올바르지 않아요: {name}")
    return json.loads((workflows_dir / name).read_text("utf-8"))


def load_bindings(workflows_dir: Path) -> dict[str, dict[str, list[list[str]]]]:
    return json.loads((workflows_dir / BINDINGS_FILE).read_text("utf-8"))


def fill_workflow(workflow: dict, binding: dict[str, list[list[str]]], params: FillParams) -> dict:
    if ("image" in binding) != (params.image is not None):
        raise WorkflowBindingError("image 바인딩과 입력 이미지가 맞지 않아요")
    for key in REQUIRED_KEYS:
        if key not in binding:
            raise WorkflowBindingError(f"{key} 바인딩이 없어요")
    values = {
        "prompt": TRANSPARENT_PROMPT_PREFIX + params.prompt if params.transparent else params.prompt,
        "seed": params.seed,
        "width": params.width,
        "height": params.height,
        "steps": params.steps,
        "filename_prefix": params.filename_prefix,
        "image": params.image,
    }
    out = copy.deepcopy(workflow)
    for key, value in values.items():
        for node_id, input_name in binding.get(key, []):
            inputs = out.get(node_id, {}).get("inputs", {})
            if input_name not in inputs:
                raise WorkflowBindingError(f"{key} → {node_id}.{input_name} 없음")
            inputs[input_name] = value
    return out
