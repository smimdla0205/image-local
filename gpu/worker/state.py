"""잡 상태 저장소. 로컬은 MemoryStore, Modal 은 DictStore(modal.Dict).

잡 레코드(status·step·output)는 실행하는 쪽이 쓰고, 웹 쪽이 쓰는 call_id·cancel_requested 는
meta 키에 따로 둔다(한 레코드를 get→put 으로 고칠 때 서로의 쓰기를 덮지 않게).
"""

import threading
from typing import Any, Protocol

from .schemas import JobRequest, JobStatusResponse, OutputInfo

ACTIVE_STATUSES = ("queued", "running")
TERMINAL_STATUSES = ("succeeded", "failed", "cancelled")


class JobStore(Protocol):
    def get(self, job_id: str) -> dict | None: ...

    def put(self, job_id: str, record: dict) -> None: ...

    def update(self, job_id: str, **fields: Any) -> dict: ...

    def transition(self, job_id: str, from_statuses: tuple[str, ...], **fields: Any) -> dict | None:
        """status 가 from_statuses 중 하나일 때만 fields 를 쓰고 새 레코드를, 아니면(없는 잡 포함) None 을 돌려준다."""
        ...

    def delete(self, job_id: str) -> None: ...

    def items(self) -> list[tuple[str, dict]]: ...

    def put_meta(self, job_id: str, key: str, value: Any) -> None: ...

    def get_meta(self, job_id: str, key: str) -> Any | None: ...


class MemoryStore:
    def __init__(self) -> None:
        self._jobs: dict[str, dict] = {}
        self._meta: dict[tuple[str, str], Any] = {}
        self._lock = threading.Lock()

    def get(self, job_id: str) -> dict | None:
        with self._lock:
            record = self._jobs.get(job_id)
            return dict(record) if record is not None else None

    def put(self, job_id: str, record: dict) -> None:
        with self._lock:
            self._jobs[job_id] = dict(record)

    def update(self, job_id: str, **fields: Any) -> dict:
        with self._lock:
            record = self._jobs[job_id]
            record.update(fields)
            return dict(record)

    def transition(self, job_id: str, from_statuses: tuple[str, ...], **fields: Any) -> dict | None:
        # 확인과 쓰기를 한 잠금 안에서 해 취소·완료가 서로를 덮지 않는다
        with self._lock:
            record = self._jobs.get(job_id)
            if record is None or record["status"] not in from_statuses:
                return None
            record.update(fields)
            return dict(record)

    def delete(self, job_id: str) -> None:
        with self._lock:
            self._jobs.pop(job_id, None)

    def items(self) -> list[tuple[str, dict]]:
        with self._lock:
            return [(job_id, dict(record)) for job_id, record in self._jobs.items()]

    def put_meta(self, job_id: str, key: str, value: Any) -> None:
        with self._lock:
            self._meta[(job_id, key)] = value

    def get_meta(self, job_id: str, key: str) -> Any | None:
        with self._lock:
            return self._meta.get((job_id, key))


class DictLike(Protocol):
    """modal.Dict 와 같은 모양."""

    def get(self, key: str, default: Any = None) -> Any: ...

    def put(self, key: str, value: Any) -> Any: ...

    def pop(self, key: str) -> Any: ...

    def items(self) -> Any: ...


class DictStore:
    """키 job:<id> 에 레코드, meta:<id>:<key> 에 웹 쪽 메타를 둔다."""

    def __init__(self, d: DictLike) -> None:
        self._d = d

    def get(self, job_id: str) -> dict | None:
        return self._d.get(f"job:{job_id}")

    def put(self, job_id: str, record: dict) -> None:
        self._d.put(f"job:{job_id}", dict(record))

    def update(self, job_id: str, **fields: Any) -> dict:
        record = self.get(job_id)
        if record is None:
            raise KeyError(job_id)
        record = {**record, **fields}
        self._d.put(f"job:{job_id}", record)
        return record

    def transition(self, job_id: str, from_statuses: tuple[str, ...], **fields: Any) -> dict | None:
        # modal.Dict 에는 비교 후 쓰기가 없어 읽고 바로 쓴다. 겹치는 창은 남지만 이미 끝난 잡을 덮는 일은 막는다
        record = self.get(job_id)
        if record is None or record["status"] not in from_statuses:
            return None
        record = {**record, **fields}
        self._d.put(f"job:{job_id}", record)
        return record

    def delete(self, job_id: str) -> None:
        try:
            self._d.pop(f"job:{job_id}")
        except KeyError:
            pass

    def items(self) -> list[tuple[str, dict]]:
        return [(key[len("job:") :], value) for key, value in self._d.items() if key.startswith("job:")]

    def put_meta(self, job_id: str, key: str, value: Any) -> None:
        self._d.put(f"meta:{job_id}:{key}", value)

    def get_meta(self, job_id: str, key: str) -> Any | None:
        return self._d.get(f"meta:{job_id}:{key}")


def new_record(job: JobRequest, created_at: float) -> dict:
    return {**job.model_dump(), "status": "queued", "step": 0, "total": job.steps, "error": None, "output": None, "created_at": created_at}


def queue_position(store: JobStore, record: dict, items: list[tuple[str, dict]] | None = None) -> int:
    """대기 중인 잡 앞에 먼저 만들어진 queued·running 잡 수. 대기 중이 아니면 0.

    items 를 넘기면 그 스냅샷으로 센다(요청 하나에서 저장소를 한 번만 훑게).
    """
    if record["status"] != "queued":
        return 0
    key = (record["created_at"], record["id"])
    snapshot = store.items() if items is None else items
    return sum(1 for _, other in snapshot if other["status"] in ACTIVE_STATUSES and (other["created_at"], other["id"]) < key)


def to_status(record: dict, position: int) -> JobStatusResponse:
    output = record.get("output")
    return JobStatusResponse(
        id=record["id"],
        status=record["status"],
        step=record["step"],
        total=record["total"],
        queue_position=position,
        error=record.get("error"),
        output=OutputInfo(**output) if output else None,
    )
