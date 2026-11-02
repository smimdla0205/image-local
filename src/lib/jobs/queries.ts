// DB 행 → 응답 DTO 변환과 조회
import type { Conversation, Image, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { isModelId, type ModelId } from "@/lib/gpu/models";
import type { ConversationDetailDto, ConversationDto, ImageDto, JobDto, WorkerState } from "@/lib/jobs/schemas";

export const jobInclude = { image: true, inputImage: true } as const satisfies Prisma.JobInclude;
export type JobWithImages = Prisma.JobGetPayload<{ include: typeof jobInclude }>;

// 화면에 올리는 최근 잡 수(그보다 오래된 잡은 v1 에서 보이지 않는다)
const DETAIL_JOB_LIMIT = 100;

// DB 의 모델 문자열은 만들 때 검증했다. 그래도 표에 없는 값이면 조용히 바꾸지 않고 오류로 드러낸다
function toModelId(model: string): ModelId {
  if (!isModelId(model)) throw new Error("알 수 없는 모델 id");
  return model;
}

export function imageUrls(id: string): { url: string; thumbUrl: string } {
  return { url: `/api/files/images/${id}.png`, thumbUrl: `/api/files/thumbs/${id}.webp` };
}

export function toImageDto(i: Image): ImageDto {
  return {
    id: i.id,
    kind: i.kind,
    conversationId: i.conversationId,
    jobId: i.jobId,
    model: isModelId(i.model) ? i.model : null,
    prompt: i.prompt,
    seed: i.seed,
    steps: i.steps,
    width: i.width,
    height: i.height,
    hasAlpha: i.hasAlpha,
    version: i.version,
    parentId: i.parentId,
    ...imageUrls(i.id),
    createdAt: i.createdAt.toISOString(),
  };
}

export function toJobDto(j: JobWithImages): JobDto {
  return {
    id: j.id,
    conversationId: j.conversationId,
    batchId: j.batchId,
    model: toModelId(j.model),
    kind: j.kind,
    prompt: j.prompt,
    width: j.width,
    height: j.height,
    seed: j.seed,
    steps: j.steps,
    transparent: j.transparent,
    status: j.status,
    step: j.step,
    queuePosition: j.queuePosition,
    error: j.error,
    inputImage: j.inputImage ? toImageDto(j.inputImage) : null,
    image: j.image ? toImageDto(j.image) : null,
    createdAt: j.createdAt.toISOString(),
  };
}

export async function getConversationDetail(id: string): Promise<{ conversation: Conversation; jobs: JobWithImages[] } | null> {
  const conversation = await prisma.conversation.findUnique({ where: { id } });
  if (!conversation) return null;
  // 최신 DETAIL_JOB_LIMIT 개를 가져와 오래된 순으로 돌려준다
  const recent = await prisma.job.findMany({
    where: { conversationId: id },
    include: jobInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: DETAIL_JOB_LIMIT,
  });
  return { conversation, jobs: recent.reverse() };
}

function toConversationDto(c: Conversation, thumbImageId: string | null): ConversationDto {
  return {
    id: c.id,
    title: c.title,
    model: toModelId(c.model),
    thumbUrl: thumbImageId ? imageUrls(thumbImageId).thumbUrl : null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function toConversationDetailDto(c: Conversation, jobs: JobWithImages[], worker: WorkerState): ConversationDetailDto {
  const latestImage = [...jobs].reverse().find((j) => j.image)?.image ?? null;
  return { ...toConversationDto(c, latestImage?.id ?? null), jobs: jobs.map(toJobDto), worker };
}

export async function listConversations(limit: number): Promise<ConversationDto[]> {
  // 썸네일은 대화마다 최신 생성·고침 이미지 하나(관계 include 로 한 번에 가져온다)
  const rows = await prisma.conversation.findMany({
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit,
    include: { images: { where: { kind: { not: "UPLOADED" } }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true } } },
  });
  return rows.map((r) => toConversationDto(r, r.images[0]?.id ?? null));
}
