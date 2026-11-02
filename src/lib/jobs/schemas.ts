// 요청 검증(zod)과 응답 DTO. 클라이언트 컴포넌트와 같이 쓴다. 단위 테스트가 불러오므로 상대 경로 import 만 쓴다
import { z } from "zod";

import { MODEL_IDS, type ModelId } from "../gpu/models";
import { type Ratio, RATIOS } from "../gpu/sizes";

export type { ModelId, Ratio };

export const SEED_MAX = 2_147_483_647;
export const PROMPT_MAX = 4000;

// 쿼리스트링의 id 형식(소문자·숫자). 형식이 다르면 null
export const ID_RE = /^[a-z0-9]+$/;
export function parseId(raw: string | null): string | null {
  return raw && ID_RE.test(raw) ? raw : null;
}

export const modelIdSchema = z.enum(MODEL_IDS);
export const ratioSchema = z.enum(RATIOS);

export const jobOptionsSchema = z.object({
  prompt: z.string().trim().min(1).max(PROMPT_MAX),
  // 고치기(inputImageId 있음)면 무시하고 입력 이미지 크기를 쓴다
  ratio: ratioSchema.default("1:1"),
  count: z.union([z.literal(1), z.literal(2), z.literal(4)]).default(1),
  // 없으면 잡마다 무작위, 있으면 i번째 잡 = (seed + i) % (SEED_MAX + 1)
  seed: z.number().int().min(0).max(SEED_MAX).optional(),
  // qwen-turbo 만 true 를 받는다(create.ts 가 모델 표로 검사)
  transparent: z.boolean().default(false),
  // 있으면 이어서 고치기(kind = EDIT)
  inputImageId: z.string().min(1).max(64).optional(),
});

export const createConversationBodySchema = jobOptionsSchema.extend({ model: modelIdSchema });
export const createJobsBodySchema = jobOptionsSchema;

export const conversationListQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(60).default(60) });
export const imageListQuerySchema = z.object({
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(60).default(60),
  model: modelIdSchema.optional(),
  q: z.string().trim().max(200).optional(),
});

// 응답 DTO (날짜는 ISO 문자열)
export type ImageKindValue = "GENERATED" | "EDITED" | "UPLOADED";
export type JobStatusValue = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export type ImageDto = {
  id: string;
  kind: ImageKindValue;
  conversationId: string | null;
  jobId: string | null;
  model: ModelId | null;
  prompt: string | null;
  seed: number | null;
  steps: number | null;
  width: number;
  height: number;
  hasAlpha: boolean;
  version: number;
  parentId: string | null;
  url: string;
  thumbUrl: string;
  previewUrl: string;
  createdAt: string;
};

export type JobDto = {
  id: string;
  conversationId: string;
  batchId: string;
  model: ModelId;
  kind: "GENERATE" | "EDIT";
  prompt: string;
  width: number;
  height: number;
  seed: number;
  steps: number;
  transparent: boolean;
  status: JobStatusValue;
  step: number;
  queuePosition: number | null;
  error: string | null;
  inputImage: ImageDto | null;
  image: ImageDto | null;
  createdAt: string;
};

export type ConversationDto = { id: string; title: string | null; model: ModelId; thumbUrl: string | null; createdAt: string; updatedAt: string };
export type WorkerState = { reachable: boolean };
export type ConversationDetailDto = ConversationDto & { jobs: JobDto[]; worker: WorkerState };
export type ConversationListDto = { items: ConversationDto[] };
export type JobsCreatedDto = { jobs: JobDto[]; worker: WorkerState };
export type ImageListDto = { items: ImageDto[]; nextCursor: string | null };
export type ApiErrorBody = { error: { code: string; message: string } };
