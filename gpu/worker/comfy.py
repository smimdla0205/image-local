"""ComfyUI 서버 클라이언트: HTTP(업로드·큐·결과)와 WebSocket(진행 상황)."""

import json
import time
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from typing import Protocol

import httpx
import websocket


class ComfyError(Exception):
    """ComfyUI 가 요청을 거절했거나 실행 중 오류를 냈다."""


class ComfyInterrupted(ComfyError):
    """실행이 인터럽트(중지)됐다."""


@dataclass(frozen=True)
class Progress:
    step: int
    total: int


class WsLike(Protocol):
    def recv(self) -> str | bytes: ...

    def settimeout(self, timeout: float) -> None: ...

    def close(self) -> None: ...


WsFactory = Callable[[str], WsLike]


def default_ws_factory(url: str) -> WsLike:
    return websocket.create_connection(url, timeout=5.0)


def _describe_rejection(body: object) -> str:
    """POST /prompt 거절 본문에서 사람이 읽을 오류 문구를 모은다."""
    if not isinstance(body, dict):
        return ""
    parts = []
    error = body.get("error")
    if isinstance(error, dict) and error.get("message"):
        parts.append(str(error["message"]))
    for node_id, node in (body.get("node_errors") or {}).items():
        for e in node.get("errors", []):
            parts.append(f"{node_id}: {e.get('message', '')} {e.get('details', '')}".strip())
    return "; ".join(parts)


class ComfyClient:
    def __init__(self, base_url: str, http: httpx.Client, idle_limit_s: float = 300.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.http = http
        self.idle_limit_s = idle_limit_s

    def upload_image(self, name: str, data: bytes) -> str:
        r = self.http.post(f"{self.base_url}/upload/image", files={"image": (name, data, "image/png")}, data={"overwrite": "true", "type": "input"})
        if r.status_code != 200:
            raise ComfyError(f"입력 이미지를 올리지 못했어요(HTTP {r.status_code})")
        return r.json()["name"]

    def queue_prompt(self, workflow: dict, client_id: str) -> str:
        r = self.http.post(f"{self.base_url}/prompt", json={"prompt": workflow, "client_id": client_id})
        try:
            body = r.json()
        except ValueError:
            body = None
        if r.status_code != 200 or not isinstance(body, dict) or body.get("node_errors"):
            raise ComfyError(f"워크플로를 받지 않았어요: {_describe_rejection(body) or f'HTTP {r.status_code}'}")
        return body["prompt_id"]

    def ws_url(self, client_id: str) -> str:
        scheme, rest = self.base_url.split("://", 1)
        return f"{'wss' if scheme == 'https' else 'ws'}://{rest}/ws?clientId={client_id}"

    def connect_ws(self, client_id: str, ws_factory: WsFactory) -> WsLike:
        return ws_factory(self.ws_url(client_id))

    def iter_progress(self, prompt_id: str, ws: WsLike) -> Iterator[Progress | None]:
        """이 프롬프트의 진행을 낸다. 메시지 없이 1초가 지나면 None(호출한 쪽이 취소를 확인할 틈).

        끝은 executing(node=None) 이다. execution_success 는 결과 기록(history) 전에 오므로 끝으로 보지 않는다.
        """
        ws.settimeout(1.0)
        last = time.monotonic()
        while True:
            try:
                raw = ws.recv()
            except websocket.WebSocketTimeoutException:
                if time.monotonic() - last >= self.idle_limit_s:
                    raise ComfyError(f"ComfyUI 진행 메시지가 {self.idle_limit_s:.0f}초 동안 없어요") from None
                yield None
                continue
            last = time.monotonic()
            if isinstance(raw, bytes):  # 미리보기 이미지
                continue
            message = json.loads(raw)
            data = message.get("data") or {}
            if data.get("prompt_id") != prompt_id:
                continue
            kind = message.get("type")
            if kind == "progress":
                yield Progress(int(data["value"]), int(data["max"]))
            elif kind == "executing" and data.get("node") is None:
                return
            elif kind == "execution_error":
                raise ComfyError(str(data.get("exception_message") or "알 수 없는 실행 오류예요"))
            elif kind == "execution_interrupted":
                raise ComfyInterrupted("실행을 중지했어요")

    def history(self, prompt_id: str) -> dict:
        r = self.http.get(f"{self.base_url}/history/{prompt_id}")
        if r.status_code != 200:
            raise ComfyError(f"실행 기록을 읽지 못했어요(HTTP {r.status_code})")
        return r.json().get(prompt_id, {})

    def fetch_output(self, filename: str, subfolder: str, type_: str) -> bytes:
        r = self.http.get(f"{self.base_url}/view", params={"filename": filename, "subfolder": subfolder, "type": type_})
        if r.status_code != 200:
            raise ComfyError(f"결과 이미지를 받지 못했어요(HTTP {r.status_code})")
        return r.content

    def interrupt(self, prompt_id: str) -> None:
        self.http.post(f"{self.base_url}/interrupt", json={"prompt_id": prompt_id})
