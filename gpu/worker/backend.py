"""잡을 실제로 처리하는 백엔드 계약과 GPU 없이 도는 MockBackend."""

import logging
import queue
import threading
import time
import uuid
from io import BytesIO
from typing import Protocol

from PIL import Image, ImageDraw, ImageOps

from .schemas import CancelResponse, InputResponse, JobRequest, JobStatusResponse, OutputInfo
from .state import ACTIVE_STATUSES, CANCEL_REQUESTED, TERMINAL_STATUSES, JobStore, MemoryStore, new_record, status_of

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

    def submit(self, job: JobRequest) -> tuple[JobStatusResponse, bool]:
        """잡을 만들고 (상태, 새로 만들었는지) 를 돌려준다. 같은 id 가 이미 있으면 그 상태와 False(멱등)."""
        ...

    def status(self, job_id: str) -> JobStatusResponse | None: ...

    def output(self, job_id: str) -> bytes | None: ...

    def cancel(self, job_id: str) -> CancelResponse: ...


# 입력 이미지: 받는 형식과 픽셀 수 상한(헤더만 읽고 디코드 전에 거른다 — 압축 폭탄 방지)
ALLOWED_INPUT_FORMATS = {"PNG", "JPEG", "WEBP"}
MAX_INPUT_PIXELS = 4096 * 4096
# 알파 채널이 있는 Pillow 이미지 모드(입력 저장과 결과 확인이 같이 쓴다)
ALPHA_MODES = ("RGBA", "LA", "PA")


def decode_image(data: bytes) -> Image.Image:
    """바이트를 Pillow 이미지로 연다. 형식·크기가 맞지 않거나 읽을 수 없으면 InvalidImage."""
    try:
        img = Image.open(BytesIO(data))
    except Exception as e:  # Pillow 는 형식마다 다른 예외를 낸다
        raise InvalidImage("입력 이미지를 읽을 수 없어요") from e
    if img.format not in ALLOWED_INPUT_FORMATS:
        raise InvalidImage("PNG, JPEG, WebP 이미지만 받아요")
    if img.width * img.height > MAX_INPUT_PIXELS:
        raise InvalidImage("입력 이미지가 너무 커요")
    try:
        img.load()
    except Exception as e:
        raise InvalidImage("입력 이미지를 읽을 수 없어요") from e
    # 휴대폰 사진의 EXIF 회전을 픽셀에 반영한다(ComfyUI 는 EXIF 를 보지 않는다)
    return ImageOps.exif_transpose(img)


def cancel_record(store: JobStore, job_id: str) -> CancelResponse:
    """취소 요청 공통 규칙: 없으면 404, 끝났으면 409, 대기 중이면 바로 cancelled, 실행 중이면 플래그만 켠다."""

    def require_unfinished() -> None:
        record = store.get(job_id)
        if record is None:
            raise JobNotFound("잡을 찾을 수 없어요")
        if record["status"] in TERMINAL_STATUSES:
            raise AlreadyFinished("이미 끝난 잡이에요")

    require_unfinished()
    # 실행하는 쪽이 이 플래그를 보고 멈춘다. 상태보다 먼저 켜야 대기열에서 막 꺼낸 잡도 놓치지 않는다
    store.put_meta(job_id, CANCEL_REQUESTED, True)
    if store.transition(job_id, ("queued",), status="cancelled") is not None:
        return CancelResponse(id=job_id, status="cancelled")
    # 그 사이 실행이 시작됐거나 끝났다. 끝난 잡은 덮어쓰지 않는다
    require_unfinished()
    return CancelResponse(id=job_id, status="cancel_requested")


def claim_queued(store: JobStore, job_id: str) -> dict | None:
    """실행을 시작할 대기 중 잡의 레코드. 없거나 대기 중이 아니면 None, 취소가 요청돼 있으면 cancelled 로 닫고 None."""
    record = store.get(job_id)
    if record is None or record["status"] != "queued":
        return None
    if store.get_meta(job_id, CANCEL_REQUESTED):
        store.transition(job_id, ("queued",), status="cancelled")
        return None
    return record


# 모델별 mock 출력 색
_MOCK_COLORS = {"klein": (63, 81, 181), "qwen-turbo": (0, 150, 136), "moss": (255, 152, 0)}


def render_mock_png(model: str, width: int, height: int, transparent: bool) -> bytes:
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
    return buf.getvalue()


class MockBackend:
    """GPU 없이 계약대로 움직이는 백엔드. 잡은 한 스레드가 FIFO 로 처리하고 step 마다 step_interval 초 쉰다.

    프롬프트 접두어로 실패를 흉내 낸다: "[fail]" 은 마지막 step 뒤 failed, "[lost]" 는 레코드를 지운다(이후 404),
    "[slow-output]" 은 끝난 뒤 결과를 두 번 '아직 없음'으로 낸다(Modal Volume 반영이 늦는 경우).
    "[stall]" 은 running·0 step 에 머물다 취소되면 cancelled(GPU 가 늦게 깨는 경우).
    """

    name = "mock"

    def __init__(self, store: JobStore | None = None, step_interval: float = 0.2) -> None:
        self.store = store if store is not None else MemoryStore()
        self.step_interval = step_interval
        self._inputs: set[str] = set()
        self._outputs: dict[str, bytes] = {}
        self._output_misses: dict[str, int] = {}
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
        self._inputs.add(input_id)
        return InputResponse(input_id=input_id, width=img.width, height=img.height)

    def submit(self, job: JobRequest) -> tuple[JobStatusResponse, bool]:
        # 같은 id 가 동시에 두 번 와도 잡은 하나만 만든다(확인과 저장을 한 잠금 안에서)
        with self._lock:
            existing = self.store.get(job.id)
            if existing is not None:
                return status_of(self.store, existing), False
            if job.kind == "edit" and job.input_id not in self._inputs:
                raise InvalidJob("input_id 를 찾을 수 없어요")
            # 같은 시각에 들어온 잡도 순서가 섞이지 않게 created_at 을 늘려 간다
            created_at = max(time.time(), self._last_created + 1e-6)
            self._last_created = created_at
            record = new_record(job, created_at)
            self.store.put(job.id, record)
            self._queue.put(job.id)
        return status_of(self.store, record), True

    def status(self, job_id: str) -> JobStatusResponse | None:
        record = self.store.get(job_id)
        if record is None:
            return None
        return status_of(self.store, record)

    def output(self, job_id: str) -> bytes | None:
        record = self.store.get(job_id)
        if record is None or record["status"] != "succeeded":
            return None
        if self._output_misses.get(job_id, 0) > 0:
            self._output_misses[job_id] -= 1
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
                self.store.transition(job_id, ACTIVE_STATUSES, status="failed", error="워커 내부 오류예요")

    def _run(self, job_id: str) -> None:
        record = claim_queued(self.store, job_id)
        if record is None:
            return
        # 그 사이 취소됐으면 시작하지 않는다(cancelled 를 running 으로 되살리지 않게)
        if self.store.transition(job_id, ("queued",), status="running") is None:
            return
        total = record["total"]
        prompt: str = record["prompt"]
        if prompt.startswith("[stall]"):
            # 0 step 에 머물다 취소되면 끝난다(GPU 가 늦게 깨는 경우를 흉내)
            while not self._stop.wait(self.step_interval):
                if self.store.get_meta(job_id, CANCEL_REQUESTED):
                    self.store.transition(job_id, ("running",), status="cancelled")
                    return
            return
        for step in range(1, total + 1):
            if self._stop.wait(self.step_interval):
                return
            if self.store.get_meta(job_id, CANCEL_REQUESTED):
                self.store.transition(job_id, ("running",), status="cancelled")
                return
            if self.store.transition(job_id, ("running",), step=step) is None:
                return
        if prompt.startswith("[fail]"):
            self.store.transition(job_id, ("running",), status="failed", error="모의 실패예요")
            return
        if prompt.startswith("[lost]"):
            self.store.delete(job_id)
            return
        if prompt.startswith("[slow-output]"):
            self._output_misses[job_id] = 2
        self._outputs[job_id] = render_mock_png(record["model"], record["width"], record["height"], record["transparent"])
        output = OutputInfo(width=record["width"], height=record["height"], has_alpha=record["transparent"])
        self.store.transition(job_id, ("running",), status="succeeded", step=total, output=output.model_dump())
