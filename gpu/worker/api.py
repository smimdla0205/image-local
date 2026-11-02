"""워커 HTTP API(FastAPI). 계약은 플랜의 "워커 HTTP API 계약" 표와 같다.

/health 를 뺀 모든 경로는 Bearer 토큰이 필요하다. 요청 본문·프롬프트는 로그에 쓰지 않는다.
"""

import hmac

from fastapi import FastAPI, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .backend import Backend, BackendError
from .models import MODEL_IDS
from .schemas import CancelResponse, HealthResponse, InputResponse, JobAcceptedResponse, JobRequest, JobStatusResponse

MAX_INPUT_BYTES = 20 * 1024 * 1024
ALLOWED_INPUT_TYPES = {"image/png", "image/jpeg", "image/webp"}


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def error_response(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


def create_app(backend: Backend, token: str) -> FastAPI:
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    expected = token.encode("utf-8")

    @app.middleware("http")
    async def require_bearer(request: Request, call_next):
        if request.url.path == "/health":
            return await call_next(request)
        header = request.headers.get("authorization", "")
        received = header[len("Bearer ") :] if header.startswith("Bearer ") else ""
        # 상수 시간 비교. 헤더가 비ASCII 여도 bytes 로 바꿔 비교하므로 401 이 된다
        if not received or not hmac.compare_digest(received.encode("utf-8"), expected):
            return error_response(401, "unauthorized", "인증 토큰이 맞지 않아요")
        return await call_next(request)

    @app.exception_handler(RequestValidationError)
    async def on_validation_error(_request: Request, exc: RequestValidationError):
        # 입력값(input)은 싣지 않는다 — 프롬프트가 섞일 수 있다
        parts = [f"{'.'.join(str(p) for p in err.get('loc', ()))}: {err.get('msg', '')}" for err in exc.errors()]
        return error_response(400, "invalid_job", "; ".join(parts) or "요청이 올바르지 않아요")

    @app.exception_handler(BackendError)
    async def on_backend_error(_request: Request, exc: BackendError):
        return error_response(exc.http_status, exc.code, exc.message)

    @app.exception_handler(ApiError)
    async def on_api_error(_request: Request, exc: ApiError):
        return error_response(exc.status, exc.code, exc.message)

    @app.exception_handler(StarletteHTTPException)
    async def on_http_error(_request: Request, exc: StarletteHTTPException):
        code = {404: "not_found", 405: "method_not_allowed"}.get(exc.status_code, "http_error")
        return error_response(exc.status_code, code, "찾을 수 없어요" if exc.status_code == 404 else "요청을 처리할 수 없어요")

    @app.get("/health")
    def health() -> HealthResponse:
        return HealthResponse(ok=True, backend=backend.name, models=list(MODEL_IDS))

    @app.post("/inputs", status_code=201)
    async def put_input(request: Request) -> InputResponse:
        content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
        if content_type not in ALLOWED_INPUT_TYPES:
            raise ApiError(415, "unsupported_media_type", "PNG, JPEG, WebP 만 받아요")
        declared = request.headers.get("content-length", "")
        if declared.isdigit() and int(declared) > MAX_INPUT_BYTES:
            raise ApiError(413, "payload_too_large", "입력 이미지는 20MB 이하여야 해요")
        chunks: list[bytes] = []
        size = 0
        # Content-Length 가 없거나 틀려도 실제로 읽은 양으로 한 번 더 막는다
        async for chunk in request.stream():
            size += len(chunk)
            if size > MAX_INPUT_BYTES:
                raise ApiError(413, "payload_too_large", "입력 이미지는 20MB 이하여야 해요")
            chunks.append(chunk)
        data = b"".join(chunks)
        if not data:
            raise ApiError(400, "invalid_image", "입력 이미지가 비어 있어요")
        # 디코드·저장은 블로킹이라 스레드풀에서 돈다
        return await run_in_threadpool(backend.put_input, data, content_type)

    @app.post("/jobs", status_code=202)
    def create_job(job: JobRequest, response: Response) -> JobAcceptedResponse | JobStatusResponse:
        existing = backend.status(job.id)
        if existing is not None:
            # 같은 id 를 다시 보내면 새로 만들지 않고 지금 상태를 돌려준다(멱등)
            response.status_code = 200
            return existing
        accepted = backend.submit(job)
        return JobAcceptedResponse(id=accepted.id, status="queued", queue_position=accepted.queue_position)

    @app.get("/jobs/{job_id}")
    def get_job(job_id: str) -> JobStatusResponse:
        status = backend.status(job_id)
        if status is None:
            raise ApiError(404, "not_found", "잡을 찾을 수 없어요")
        return status

    @app.get("/jobs/{job_id}/output")
    def get_output(job_id: str) -> Response:
        if backend.status(job_id) is None:
            raise ApiError(404, "not_found", "잡을 찾을 수 없어요")
        data = backend.output(job_id)
        if data is None:
            raise ApiError(409, "not_ready", "결과가 아직 없어요")
        return Response(content=data, media_type="image/png")

    @app.delete("/jobs/{job_id}", status_code=202)
    def cancel_job(job_id: str) -> CancelResponse:
        return backend.cancel(job_id)

    return app
