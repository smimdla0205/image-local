"""Modal 공통 정의: 앱, 컨테이너 이미지, Volume, Secret, ComfyUI 실행 명령. modal_app.py(워커)와 modal_ui.py(템플릿 내보내기)가 같이 쓴다."""

from pathlib import Path

import modal

GPU_DIR = Path(__file__).resolve().parent
APP_NAME = "imagen-local-gpu"
COMFY_VERSION = "0.43.0"
COMFY_CLI_VERSION = "1.24.0"
COMFY_PORT = 8188
EXTRA_MODEL_PATHS = "/root/extra_model_paths.yaml"  # 컨테이너 안의 ComfyUI 모델 경로 파일

app = modal.App(APP_NAME)
models_volume = modal.Volume.from_name("imagen-local-models", create_if_missing=True)  # /models: 모델 파일
data_volume = modal.Volume.from_name("imagen-local-data", create_if_missing=True)  # /data: 입력·결과 이미지
worker_secret = modal.Secret.from_name("imagen-local-worker")  # GPU_API_TOKEN, HF_TOKEN(있으면)

# modal_app.py 가 모듈 맨 위에서 worker.api(fastapi)·worker.runner(httpx, websocket, pillow)를 읽으므로 모든 이미지에 넣는다
RUNTIME_PIP = ("fastapi==0.162.0", "httpx==0.28.1", "websocket-client==1.9.2", "pillow==13.0.0")

comfy_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("git", "libgl1", "libglib2.0-0")
    .pip_install(f"comfy-cli=={COMFY_CLI_VERSION}")
    .run_commands(f"comfy --skip-prompt install --fast-deps --nvidia --version {COMFY_VERSION} --skip-manager")
    .pip_install(*RUNTIME_PIP)
    # add_local_* 는 항상 마지막 레이어(코드만 바뀌면 이미지를 다시 빌드하지 않는다)
    .add_local_file(GPU_DIR / "extra_model_paths.yaml", EXTRA_MODEL_PATHS)
    .add_local_dir(GPU_DIR / "workflows", "/root/workflows")
    .add_local_python_source("worker", "modal_common")
)
cpu_image = modal.Image.debian_slim(python_version="3.12").pip_install(*RUNTIME_PIP)
web_image = cpu_image.add_local_python_source("worker", "modal_common")
download_image = cpu_image.pip_install("huggingface_hub==2.4.0").add_local_python_source("worker", "modal_common")


def comfy_launch(*extra: str) -> list[str]:
    """ComfyUI 를 백그라운드로 띄우는 명령. 워커와 UI 가 앞부분을 같이 쓰고, extra 는 ComfyUI 인자로 덧붙는다."""
    return ["comfy", "--skip-prompt", "launch", "--background", "--", "--port", str(COMFY_PORT), "--extra-model-paths-config", EXTRA_MODEL_PATHS, "--disable-auto-launch", *extra]
