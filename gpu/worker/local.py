"""로컬 mock 워커 진입점: uvicorn worker.local:app (루트 npm run qa:worker:mock).

환경변수: GPU_API_TOKEN(기본 dev-token), WORKER_BACKEND(mock 만), MOCK_STEP_MS(step 하나 지연, 기본 250).
"""

import os

from .api import create_app
from .backend import MockBackend


def build_app():
    backend_name = os.environ.get("WORKER_BACKEND", "mock")
    if backend_name != "mock":
        raise SystemExit("WORKER_BACKEND 는 mock 만 쓸 수 있어요. Modal 워커는 gpu/modal_app.py 로 배포해요")
    step_ms = int(os.environ.get("MOCK_STEP_MS", "250"))
    backend = MockBackend(step_interval=step_ms / 1000)
    backend.start()
    return create_app(backend, os.environ.get("GPU_API_TOKEN", "dev-token"))


app = build_app()
