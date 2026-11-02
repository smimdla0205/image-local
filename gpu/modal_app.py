"""Modal GPU 워커: 웹 함수(FastAPI, CPU) + GPU 클래스(H100, ComfyUI) + 모델 다운로드 함수.

배포하면 웹 주소는 https://<workspace>--imagen-local-gpu-web.modal.run 이다.
웹 함수는 잡을 modal.Dict 에 쓰고 GPU 메서드를 spawn 한다. GPU 컨테이너는 하나(max_containers=1)라 잡을 차례로 돈다.
"""

import os
import shutil
import subprocess
import time
from pathlib import Path

import grpclib.exceptions
import httpx
import modal

from modal_common import app, comfy_image, data_volume, download_image, models_volume, web_image, worker_secret
from worker.api import create_app
from worker.comfy import ComfyClient
from worker.modal_backend import WORKER_DIED_MESSAGE, CallState, ModalBackend
from worker.models import all_files
from worker.runner import run_job
from worker.schemas import JobRequest
from worker.state import DictStore

jobs_dict = modal.Dict.from_name("imagen-local-jobs", create_if_missing=True)

DATA_DIR = Path("/data")
MODELS_DIR = Path("/models")
WORKFLOWS_DIR = Path("/root/workflows")
COMFY_URL = "http://127.0.0.1:8188"
# ComfyUI 자체의 입출력 폴더는 컨테이너 디스크에 둔다. Volume(/data)에는 러너가 남긴 결과만 올린다
COMFY_IN, COMFY_OUT = Path("/tmp/comfy/in"), Path("/tmp/comfy/out")
COMFY_LAUNCH = [
    "comfy", "--skip-prompt", "launch", "--background", "--",
    "--listen", "127.0.0.1", "--port", "8188",
    "--extra-model-paths-config", "/root/extra_model_paths.yaml",
    "--output-directory", str(COMFY_OUT), "--input-directory", str(COMFY_IN),
    "--disable-auto-launch",
]  # fmt: skip
# ComfyUI 실행 명령과 준비 대기를 합쳐 컨테이너 시작 제한 안에 끝나게 한다(넘으면 Modal 이 원인 없이 컨테이너를 내린다)
STARTUP_TIMEOUT_S = 600
COMFY_LAUNCH_TIMEOUT_S = 180
COMFY_READY_TIMEOUT_S = 400


@app.cls(
    image=comfy_image,
    gpu="H100",
    timeout=600,
    startup_timeout=STARTUP_TIMEOUT_S,
    scaledown_window=300,
    max_containers=1,
    volumes={"/models": models_volume, "/data": data_volume},
    secrets=[worker_secret],
)
class GpuWorker:
    @modal.enter()
    def start(self) -> None:
        for d in (DATA_DIR / "inputs", DATA_DIR / "outputs", COMFY_IN, COMFY_OUT):
            d.mkdir(parents=True, exist_ok=True)
        subprocess.run(COMFY_LAUNCH, check=True, timeout=COMFY_LAUNCH_TIMEOUT_S)
        self.client = ComfyClient(COMFY_URL, httpx.Client(timeout=60.0))
        deadline = time.monotonic() + COMFY_READY_TIMEOUT_S
        while not self.client.alive():
            if time.monotonic() > deadline:
                raise RuntimeError("ComfyUI 가 시작되지 않았어요")
            time.sleep(2)
        self.store = DictStore(jobs_dict)

    @modal.method()
    def run(self, job_id: str) -> None:
        record = self.store.get(job_id)
        if record is None or record["status"] != "queued":
            return
        if self.store.get_meta(job_id, "cancel_requested"):
            self.store.transition(job_id, ("queued",), status="cancelled")
            return
        job = JobRequest.model_validate({key: record[key] for key in JobRequest.model_fields})
        if job.kind == "edit":
            data_volume.reload()  # 웹 함수가 받은 입력 이미지를 본다
        # 로그에는 잡 id 와 상태만 남긴다(프롬프트 없음)
        print(f"[gpu] job {job_id} start")
        try:
            run_job(
                job,
                self.client,
                self.store,
                WORKFLOWS_DIR,
                DATA_DIR / "inputs",
                DATA_DIR / "outputs",
                cancel_requested=lambda: bool(self.store.get_meta(job_id, "cancel_requested")),
                commit_output=data_volume.commit,
            )
        finally:
            # run_job 이 상태를 남기지 못하고 끝났으면(예외로 빠져나감) 실패로 닫는다
            self.store.transition(job_id, ("running",), status="failed", error=WORKER_DIED_MESSAGE)
            print(f"[gpu] job {job_id} {(self.store.get(job_id) or {}).get('status')}")
            # ComfyUI 가 죽었으면 이 컨테이너는 더 받지 않고 내려가, 다음 잡이 새 컨테이너에서 돌게 한다
            if not self.client.alive():
                print("[gpu] ComfyUI 응답 없음: 이 컨테이너는 더 받지 않는다")
                modal.experimental.stop_fetching_inputs()


def _call_state(call_id: str) -> CallState:
    try:
        modal.FunctionCall.from_id(call_id).get(timeout=0)
    except TimeoutError:  # 내장 TimeoutError: 아직 결과가 없다(대기·실행 중)
        return "pending"
    except (modal.exception.ConnectionError, grpclib.exceptions.GRPCError, grpclib.exceptions.StreamTerminatedError):
        # 이 컨테이너와 Modal 사이의 통신 문제는 GPU 실행 실패가 아니다
        return "pending"
    except Exception:
        # GPU 쪽에서 난 예외(시간 초과·시작 실패 등)가 같은 타입으로 다시 나온다 — 실행이 실패로 끝났다
        return "failed"
    return "done"


def _reload_data() -> None:
    # 같은 컨테이너의 다른 요청이 Volume 파일을 열고 있으면 reload 가 RuntimeError 를 낸다. 이번엔 건너뛰고 다음 요청에서 다시 본다
    try:
        data_volume.reload()
    except RuntimeError as e:
        print(f"[web] volume reload skipped: {type(e).__name__}")


@app.function(image=web_image, volumes={"/data": data_volume}, secrets=[worker_secret], timeout=120)
@modal.concurrent(max_inputs=100)
@modal.asgi_app()
def web():
    backend = ModalBackend(
        DictStore(jobs_dict),
        DATA_DIR,
        commit=data_volume.commit,
        reload=_reload_data,
        spawn=lambda job_id: GpuWorker().run.spawn(job_id).object_id,
        cancel_call=lambda call_id: modal.FunctionCall.from_id(call_id).cancel(),
        call_state=_call_state,
    )
    return create_app(backend, os.environ["GPU_API_TOKEN"])


@app.function(image=download_image, volumes={"/models": models_volume}, secrets=[worker_secret], timeout=7200)
def download_models() -> list[str]:
    """빠진 모델 파일만 Hugging Face 에서 받아 Volume 에 넣고, 새로 받은 경로를 돌려준다."""
    # huggingface_hub 는 다운로드 이미지에만 있어 함수 안에서 읽는다(웹·GPU 컨테이너는 이 모듈을 읽어도 이 줄을 돌지 않는다)
    from huggingface_hub import hf_hub_download

    token = os.environ.get("HF_TOKEN") or None
    fetched = []
    for f in all_files():
        target = MODELS_DIR / f.path
        if target.exists():
            continue
        if f.path == f.filename:
            hf_hub_download(repo_id=f.repo_id, filename=f.filename, local_dir=str(MODELS_DIR), token=token)
        else:
            # 리포의 파일 이름과 ComfyUI 가 찾는 이름이 다르면(MOSS LoRA) 따로 받아 옮긴다
            downloaded = hf_hub_download(repo_id=f.repo_id, filename=f.filename, local_dir=str(MODELS_DIR / "_download" / f.repo_id), token=token)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(downloaded, target)
        fetched.append(f.path)
        print(f"[download] {f.path}")
    if fetched:
        models_volume.commit()
    return fetched
