"""워커 HTTP API 요청·응답 스키마(pydantic v2)."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .models import MODELS

ModelId = Literal["klein", "qwen-turbo", "moss"]
JobKind = Literal["generate", "edit"]
JobStatus = Literal["queued", "running", "succeeded", "failed", "cancelled"]

UUID_PATTERN = r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
MAX_PIXELS = 1_200_000


class JobRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    model: ModelId
    kind: JobKind
    prompt: str = Field(min_length=1, max_length=4000)
    width: int = Field(ge=256, le=2048, multiple_of=16)
    height: int = Field(ge=256, le=2048, multiple_of=16)
    seed: int = Field(ge=0, le=2**32 - 1)
    steps: int
    transparent: bool = False
    input_id: str | None = Field(default=None, pattern=UUID_PATTERN)

    @model_validator(mode="after")
    def check_model_rules(self) -> "JobRequest":
        spec = MODELS[self.model]
        if self.kind == "edit" and self.input_id is None:
            raise ValueError("edit 에는 input_id 가 필요해요")
        if self.kind == "generate" and self.input_id is not None:
            raise ValueError("generate 에는 input_id 를 넣지 않아요")
        if self.kind == "edit" and not spec.can_edit:
            raise ValueError(f"{self.model} 는 edit 를 지원하지 않아요")
        if self.transparent and not spec.supports_transparent:
            raise ValueError("transparent 는 qwen-turbo 만 지원해요")
        if self.steps != spec.steps:
            raise ValueError(f"steps 는 {self.model} 에서 {spec.steps} 이어야 해요")
        if self.width * self.height > MAX_PIXELS:
            raise ValueError(f"width*height 는 {MAX_PIXELS} 이하여야 해요")
        return self


class InputResponse(BaseModel):
    input_id: str
    width: int
    height: int


class OutputInfo(BaseModel):
    width: int
    height: int
    content_type: Literal["image/png"] = "image/png"
    has_alpha: bool


class JobStatusResponse(BaseModel):
    id: str
    status: JobStatus
    step: int
    total: int
    queue_position: int
    error: str | None
    output: OutputInfo | None


class JobAcceptedResponse(BaseModel):
    id: str
    status: Literal["queued"]
    queue_position: int


class CancelResponse(BaseModel):
    id: str
    status: Literal["cancelled", "cancel_requested"]


class HealthResponse(BaseModel):
    ok: Literal[True]
    backend: Literal["modal", "mock"]
    models: list[str]


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody
