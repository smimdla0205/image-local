"""잡을 실제로 처리하는 백엔드 계약과 GPU 없이 도는 MockBackend."""

import logging
import queue
import threading
import time
import uuid
from io import BytesIO
from typing import Protocol

from PIL import Image, ImageDraw

from .schemas import CancelResponse, InputResponse, JobRequest, JobStatusResponse, OutputInfo
from .state import TERMINAL_STATUSES, JobStore, MemoryStore, new_record, queue_position, to_status

logger = logging.getLogger(__name__)


class BackendError(Exception):
    http_status = 500
    code = "internal_error"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class JobNotFound(BackendError):
    http_status = 404
    code = "not_found"


class AlreadyFinished(BackendError):
    http_status = 409
    code = "already_finished"


class InvalidJob(BackendError):
    http_status = 400
    code = "invalid_job"


class InvalidImage(BackendError):
    http_status = 400
    code = "invalid_image"


class Backend(Protocol):
    name: str

    def put_input(self, data: bytes, content_type: str) -> InputResponse: ...

    def submit(self, job: JobRequest) -> JobStatusResponse: ...

    def status(self, job_id: str) -> JobStatusResponse | None: ...

    def output(self, job_id: str) -> bytes | None: ...

    def cancel(self, job_id: str) -> CancelResponse: ...


def decode_image(data: bytes) -> Image.Image:
    """바이트를 Pillow 이미지로 연다. 읽을 수 없으면 InvalidImage."""
    try:
        img = Image.open(BytesIO(data))
        img.load()
    except Exception as e:  # Pillow 는 형식마다 다른 예외를 낸다
        raise InvalidImage("입력 이미지를 읽을 수 없어요") from e
    return img


def cancel_record(store: JobStore, job_id: str) -> CancelResponse:
    """취소 요청 공통 규칙: 없으면 404, 끝났으면 409, 대기 중이면 바로 cancelled, 실행 중이면 플래그만 켠다."""
    record = store.get(job_id)
    if record is None:
        raise JobNotFound("잡을 찾을 수 없어요")
    if record["status"] in TERMINAL_STATUSES:
        raise AlreadyFinished("이미 끝난 잡이에요")
    # 실행하는 쪽이 이 플래그를 보고 멈춘다. 상태보다 먼저 켜야 대기열에서 막 꺼낸 잡도 놓치지 않는다
    store.put_meta(job_id, "cancel_requested", True)
    if record["status"] == "queued":
        store.update(job_id, status="cancelled")
        return CancelResponse(id=job_id, status="cancelled")
    return CancelResponse(id=job_id, status="cancel_requested")


# 모델별 mock 출력 색
_MOCK_COLORS = {"klein": (63, 81, 181), "qwen-turbo": (0, 150, 136), "moss": (255, 152, 0)}


def render_mock_png(model: str, width: int, height: int, transparent: bool) -> tuple[bytes, bool]:
    color = _MOCK_COLORS[model]
    if transparent:
        img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        r = min(width, height) // 4
        cx, cy = width // 2, height // 2
        ImageDraw.Draw(img).ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*color, 255))
    else:
        img = Image.new("RGB", (width, height), color)
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue(), transparent


class MockBackend:
    """GPU 없이 계약대로 움직이는 백엔드. 잡은 한 스레드가 FIFO 로 처리하고 step 마다 step_interval 초 쉰다.

    프롬프트 접두어로 실패를 흉내 낸다: "[fail]" 은 마지막 step 뒤 failed, "[lost]" 는 레코드를 지운다(이후 404).
    """

    name = "mock"

    def __init__(self, store: JobStore | None = None, step_interval: float = 0.2) -> None:
        self.store = store if store is not None else MemoryStore()
        self.step_interval = step_interval
        self._inputs: dict[str, tuple[int, int]] = {}
        self._outputs: dict[str, bytes] = {}
        self._queue: queue.Queue[str | None] = queue.Queue()
        self._stop = threading.Event()
        self._lock = threading.Lock()
        self._last_created = 0.0
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread is None:
            self._thread = threading.Thread(target=self._loop, name="mock-gpu", daemon=True)
            self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._queue.put(None)
        if self._thread is not None:
            self._thread.join(timeout=5)

    def put_input(self, data: bytes, content_type: str) -> InputResponse:
        img = decode_image(data)
        input_id = str(uuid.uuid4())
        self._inputs[input_id] = img.size
        return InputResponse(input_id=input_id, width=img.width, height=img.height)

    def submit(self, job: JobRequest) -> JobStatusResponse:
        # 같은 id 가 동시에 두 번 와도 잡은 하나만 만든다(확인과 저장을 한 잠금 안에서)
        with self._lock:
            existing = self.store.get(job.id)
            if existing is not None:
                return to_status(existing, queue_position(self.store, existing))
            if job.kind == "edit" and job.input_id not in self._inputs:
                raise InvalidJob("input_id 를 찾을 수 없어요")
            # 같은 시각에 들어온 잡도 순서가 섞이지 않게 created_at 을 늘려 간다
            created_at = max(time.time(), self._last_created + 1e-6)
            self._last_created = created_at
            record = new_record(job, created_at)
            self.store.put(job.id, record)
            self._queue.put(job.id)
        return to_status(record, queue_position(self.store, record))

    def status(self, job_id: str) -> JobStatusResponse | None:
        record = self.store.get(job_id)
        if record is None:
            return None
        return to_status(record, queue_position(self.store, record))

    def output(self, job_id: str) -> bytes | None:
        record = self.store.get(job_id)
        if record is None or record["status"] != "succeeded":
            return None
        return self._outputs.get(job_id)

    def cancel(self, job_id: str) -> CancelResponse:
        return cancel_record(self.store, job_id)

    def _loop(self) -> None:
        while not self._stop.is_set():
            job_id = self._queue.get()
            if job_id is None:
                break
            try:
                self._run(job_id)
            except Exception:
                # 잡 id 만 남긴다(프롬프트는 로그에 쓰지 않는다)
                logger.exception("mock 잡 처리 실패: %s", job_id)
                if self.store.get(job_id) is not None:
                    self.store.update(job_id, status="failed", error="워커 내부 오류예요")

    def _run(self, job_id: str) -> None:
        record = self.store.get(job_id)
        if record is None or record["status"] != "queued":
            return
        if self.store.get_meta(job_id, "cancel_requested"):
            self.store.update(job_id, status="cancelled")
            return
        self.store.update(job_id, status="running")
        total = record["total"]
        for step in range(1, total + 1):
            if self._stop.wait(self.step_interval):
                return
            if self.store.get_meta(job_id, "cancel_requested"):
                self.store.update(job_id, status="cancelled")
                return
            self.store.update(job_id, step=step)
        prompt: str = record["prompt"]
        if prompt.startswith("[fail]"):
            self.store.update(job_id, status="failed", error="모의 실패예요")
            return
        if prompt.startswith("[lost]"):
            self.store.delete(job_id)
            return
        png, has_alpha = render_mock_png(record["model"], record["width"], record["height"], record["transparent"])
        self._outputs[job_id] = png
        output = OutputInfo(width=record["width"], height=record["height"], has_alpha=has_alpha)
        self.store.update(job_id, status="succeeded", step=total, output=output.model_dump())
