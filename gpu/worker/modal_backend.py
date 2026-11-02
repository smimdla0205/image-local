"""Modal 위의 백엔드. 상태는 JobStore(modal.Dict), 파일은 Volume(/data), 실행은 GPU 함수 spawn.

modal 을 import 하지 않는다 — Modal 쪽 동작(commit·reload·spawn·호출 취소·호출 상태)은 콜러블로 받아 로컬에서 테스트한다.
"""

import logging
import time
import uuid
from collections.abc import Callable
from pathlib import Path
from typing import Literal

from .backend import InvalidJob, cancel_record, decode_image
from .schemas import CancelResponse, InputResponse, JobRequest, JobStatusResponse
from .state import ACTIVE_STATUSES, JobStore, new_record, queue_position, to_status

logger = logging.getLogger(__name__)

CallState = Literal["pending", "done", "failed"]
WORKER_DIED_MESSAGE = "워커가 예기치 않게 중단됐어요"


class ModalBackend:
    name = "modal"

    def __init__(
        self,
        store: JobStore,
        data_dir: Path,
        commit: Callable[[], None],
        reload: Callable[[], None],
        spawn: Callable[[str], str],
        cancel_call: Callable[[str], None],
        call_state: Callable[[str], CallState],
    ) -> None:
        self.store = store
        self.inputs_dir = data_dir / "inputs"
        self.outputs_dir = data_dir / "outputs"
        self.commit = commit
        self.reload = reload
        self.spawn = spawn
        self.cancel_call = cancel_call
        self.call_state = call_state

    def put_input(self, data: bytes, content_type: str) -> InputResponse:
        img = decode_image(data)
        # ComfyUI LoadImage 가 바로 읽게 PNG 로 다시 저장한다(투명은 유지)
        has_alpha = img.mode in ("RGBA", "LA", "PA") or "transparency" in img.info
        img = img.convert("RGBA" if has_alpha else "RGB")
        input_id = str(uuid.uuid4())
        self.inputs_dir.mkdir(parents=True, exist_ok=True)
        img.save(self.inputs_dir / f"{input_id}.png", format="PNG")
        self.commit()
        return InputResponse(input_id=input_id, width=img.width, height=img.height)

    def _input_exists(self, input_id: str) -> bool:
        path = self.inputs_dir / f"{input_id}.png"
        if path.exists():
            return True
        # 다른 웹 컨테이너가 받은 입력일 수 있다
        self.reload()
        return path.exists()

    def submit(self, job: JobRequest) -> tuple[JobStatusResponse, bool]:
        existing = self.store.get(job.id)
        if existing is not None:
            return to_status(existing, queue_position(self.store, existing)), False
        if job.kind == "edit" and not self._input_exists(str(job.input_id)):
            raise InvalidJob("input_id 를 찾을 수 없어요")
        record = new_record(job, time.time())
        # 같은 id 가 동시에 와도(웹 컨테이너·스레드 여럿) 레코드를 만든 요청만 GPU 를 부른다
        if not self.store.create(job.id, record):
            existing = self.store.get(job.id)
            if existing is None:  # 먼저 만든 요청이 GPU 호출에 실패해 레코드를 지웠다. 앱이 다시 보낸다
                raise RuntimeError("잡 생성이 겹쳤어요")
            return to_status(existing, queue_position(self.store, existing)), False
        try:
            call_id = self.spawn(job.id)
        except Exception:
            # GPU 호출을 걸지 못했으면 레코드를 지워, 같은 id 로 다시 보낼 때 새로 만들고 다시 부르게 한다
            self.store.delete(job.id)
            raise
        self.store.put_meta(job.id, "call_id", call_id)
        return to_status(record, queue_position(self.store, record)), True

    def status(self, job_id: str) -> JobStatusResponse | None:
        record = self.store.get(job_id)
        if record is None:
            return None
        if record["status"] in ACTIVE_STATUSES:
            # GPU 컨테이너가 시간 초과·메모리 부족으로 죽으면 상태를 못 남긴다. 호출이 끝났는데 아직 진행 중이면 실패로 닫는다
            call_id = self.store.get_meta(job_id, "call_id")
            if call_id and self.call_state(call_id) != "pending":
                record = self.store.transition(job_id, ACTIVE_STATUSES, status="failed", error=WORKER_DIED_MESSAGE) or self.store.get(job_id) or record
        return to_status(record, queue_position(self.store, record))

    def output(self, job_id: str) -> bytes | None:
        record = self.store.get(job_id)
        if record is None or record["status"] != "succeeded":
            return None
        path = self.outputs_dir / f"{job_id}.png"
        if not path.exists():
            self.reload()
        return path.read_bytes() if path.exists() else None

    def cancel(self, job_id: str) -> CancelResponse:
        response = cancel_record(self.store, job_id)
        if response.status == "cancelled":
            # 대기 중이던 GPU 호출도 거둬 컨테이너가 이 잡 때문에 뜨지 않게 한다
            call_id = self.store.get_meta(job_id, "call_id")
            if call_id:
                try:
                    self.cancel_call(call_id)
                except Exception as e:
                    # 잡은 이미 취소로 기록됐다. GPU 쪽은 시작할 때 상태를 보고 건너뛴다
                    logger.warning("GPU 호출 취소 실패: %s (%s)", job_id, type(e).__name__)
        return response
