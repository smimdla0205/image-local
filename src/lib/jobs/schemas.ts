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

// DELETE /api/trash 본문. 비어 있으면 전부, id 를 주면 그것만, before 는 그 시각보다 먼저 휴지통에 들어간 것만
export const purgeBodySchema = z.object({
  conversationIds: z.array(z.string().regex(ID_RE)).max(100).optional(),
  imageIds: z.array(z.string().regex(ID_RE)).max(100).optional(),
  before: z.iso.datetime().optional(),
});

// 대화 상세에 싣는 최근 잡 수(그보다 오래된 잡은 화면에 오르지 않는다). 진행 중 잡 GET 이 한 번에 물을 수 있는 수도 같다
export const DETAIL_JOB_LIMIT = 100;
// GET /api/conversations/[id]/jobs?ids=a,b — 물을 잡 id 를 쉼표로 잇는다
export const jobIdsQuerySchema = z.object({
  ids: z
    .string()
    .transform((s) => s.split(","))
    .pipe(z.array(z.string().regex(ID_RE)).min(1).max(DETAIL_JOB_LIMIT)),
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
  // 휴지통에 있으면 옮긴 시각. 보통 목록·상세에는 null 만 온다
  deletedAt: string | null;
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

export type ConversationDto = { id: string; title: string | null; model: ModelId; thumbUrl: string | null; createdAt: string; updatedAt: string; deletedAt: string | null };
export type WorkerState = { reachable: boolean };
// 휴지통 목록. expiresAt 은 자동으로 지워지는 시각(deletedAt + 30일)
export type TrashConversationDto = ConversationDto & { deletedAt: string; expiresAt: string; imageCount: number };
export type TrashImageDto = ImageDto & { deletedAt: string; expiresAt: string };
// total 은 목록 상한(200)과 무관한 전체 수
export type TrashDto = { conversations: TrashConversationDto[]; images: TrashImageDto[]; total: { conversations: number; images: number } };
// GET /api/images/[id]/refs — 이 이미지를 원본으로 둔 고친 버전 수, 입력으로 쓴 요청 수
export type ImageRefsDto = { children: number; inputFor: number };
// counts: 삭제 확인창이 말하는 수. images 는 생성·고침 이미지, linkedConversations 는 이 대화의 이미지를 원본으로 쓰는 다른 대화 수
export type ConversationCounts = { images: number; activeJobs: number; linkedConversations: number };
export type ConversationDetailDto = ConversationDto & { jobs: JobDto[]; worker: WorkerState; counts: ConversationCounts };
export type ConversationListDto = { items: ConversationDto[] };
// 잡 묶음 응답: POST /api/conversations/[id]/jobs(만든 잡), GET 같은 경로(물은 진행 중 잡을 워커와 맞춘 것)
export type JobsDto = { jobs: JobDto[]; worker: WorkerState };
export type ImageListDto = { items: ImageDto[]; nextCursor: string | null };
export type ApiErrorBody = { error: { code: string; message: string } };
