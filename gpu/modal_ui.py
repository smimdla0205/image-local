"""ComfyUI 웹 UI. 공식 템플릿을 API 포맷으로 내보낼 때만 `modal serve` 로 잠깐 띄우고 바로 내린다(배포하지 않는다).

인증 없는 임시 주소라 시크릿·데이터 Volume 을 붙이지 않고, GPU 없이(--cpu) 띄운다. 모델 Volume 은 로더 목록 확인용이다.
"""

import subprocess

import modal

from modal_common import app, comfy_image, models_volume


@app.function(image=comfy_image, volumes={"/models": models_volume}, cpu=2, memory=4096, timeout=3600, scaledown_window=300, max_containers=1)
@modal.concurrent(max_inputs=10)
@modal.web_server(8188, startup_timeout=300)
def ui() -> None:
    subprocess.run(
        [
            "comfy", "--skip-prompt", "launch", "--background", "--",
            "--listen", "0.0.0.0", "--port", "8188",
            "--extra-model-paths-config", "/root/extra_model_paths.yaml",
            "--cpu", "--disable-auto-launch",
        ],
        check=True,
    )  # fmt: skip
