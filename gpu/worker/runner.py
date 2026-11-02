"""잡 하나를 ComfyUI 로 실행하고 상태를 저장소에 기록한다(GPU 컨테이너에서 돈다)."""

import sys
import traceback
import uuid
from collections.abc import Callable
from io import BytesIO
from pathlib import Path

from PIL import Image

from .comfy import ComfyClient, ComfyError, ComfyInterrupted, Progress, WsFactory, WsLike, default_ws_factory
from .models import MODELS
from .schemas import JobRequest, OutputInfo
from .state import JobStore
from .workflows import FillParams, fill_workflow, load_bindings, load_workflow

ERROR_MAX_CHARS = 500
# ComfyUI 밖의 예외(파일·네트워크 등)는 내부 경로가 담길 수 있어 사용자에게는 이 문구만 보인다
UNEXPECTED_ERROR = "워커에서 오류가 났어요. 다시 생성해 주세요."


def _has_alpha(img: Image.Image) -> bool:
    return img.mode in ("RGBA", "LA", "PA") and img.getextrema()[-1][0] < 255


def _find_output(history: dict) -> dict | None:
    for node_output in history.get("outputs", {}).values():
        for image in node_output.get("images", []):
            if image.get("type") == "output":
                return image
    return None


def run_job(
    job: JobRequest,
    client: ComfyClient,
    store: JobStore,
    workflows_dir: Path,
    inputs_dir: Path,
    out_dir: Path,
    cancel_requested: Callable[[], bool],
    ws_factory: WsFactory = default_ws_factory,
) -> OutputInfo | None:
    """잡을 실행해 결과 PNG 를 out_dir/<id>.png 에 저장한다. 성공하면 OutputInfo, 취소·실패·실행 안 함은 None.

    상태 전이는 조건부로 쓴다: 대기 중일 때만 시작하고(웹 쪽의 대기 중 취소를 덮지 않게), 실행 중일 때만 끝낸다.
    """
    if store.transition(job.id, ("queued",), status="running", step=0, total=job.steps) is None:
        return None
    ws: WsLike | None = None
    try:
        name = MODELS[job.model].workflow(job.kind)
        image = client.upload_image(f"{job.id}.png", (inputs_dir / f"{job.input_id}.png").read_bytes()) if job.kind == "edit" else None
        params = FillParams(job.prompt, job.seed, job.width, job.height, job.steps, f"job_{job.id}", image=image, transparent=job.transparent)
        workflow = fill_workflow(load_workflow(name, workflows_dir), load_bindings(workflows_dir)[name], params)

        client_id = uuid.uuid4().hex
        ws = client.connect_ws(client_id, ws_factory)  # 끝 메시지를 놓치지 않게 큐에 넣기 전에 연결한다
        prompt_id = client.queue_prompt(workflow, client_id)
        for progress in client.iter_progress(prompt_id, ws):
            # ComfyUI 는 실행을 시작할 때 인터럽트 표시를 지우므로 취소가 걸려 있는 동안 매번 보낸다
            if cancel_requested():
                client.interrupt(prompt_id)
            # 프롬프트 보강 같은 다른 노드의 진행(max 가 step 수와 다름)은 step 으로 쓰지 않는다
            if isinstance(progress, Progress) and progress.total == job.steps:
                store.transition(job.id, ("running",), step=min(progress.step, job.steps))

        found = _find_output(client.history(prompt_id))
        if found is None:
            raise ComfyError("결과를 남기지 않았어요")
        data = client.fetch_output(found["filename"], found.get("subfolder", ""), found["type"])
        img = Image.open(BytesIO(data))
        img.load()
        output = OutputInfo(width=img.width, height=img.height, has_alpha=_has_alpha(img))
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / f"{job.id}.png").write_bytes(data)
        store.transition(job.id, ("running",), status="succeeded", step=job.steps, output=output.model_dump())
        return output
    except ComfyInterrupted:
        store.transition(job.id, ("running",), status="cancelled")
        return None
    except ComfyError as e:
        store.transition(job.id, ("running",), status="failed", error=f"ComfyUI 오류: {e}"[:ERROR_MAX_CHARS])
        return None
    except Exception:
        # 자세한 내용은 서버 로그(stderr)에만 남긴다. 프롬프트는 예외 문구에 넣지 않는다
        print(f"[runner] job {job.id} 실패", file=sys.stderr)
        traceback.print_exc()
        store.transition(job.id, ("running",), status="failed", error=UNEXPECTED_ERROR)
        return None
    finally:
        if ws is not None:
            ws.close()
