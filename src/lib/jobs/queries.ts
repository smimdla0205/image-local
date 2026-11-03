// DB 행 → 응답 DTO 변환과 조회
import type { Conversation, Image, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { isModelId, type ModelId } from "@/lib/gpu/models";
import { type ConversationDetailDto, type ConversationDto, DETAIL_JOB_LIMIT, type ImageDto, type JobDto, type WorkerState } from "@/lib/jobs/schemas";
import { type StorageKind, storageKey } from "@/lib/storage";

export const jobInclude = { image: true, inputImage: true } as const satisfies Prisma.JobInclude;
export type JobWithImages = Prisma.JobGetPayload<{ include: typeof jobInclude }>;

// DB 의 모델 문자열은 만들 때 검증했다. 그래도 표에 없는 값이면 조용히 바꾸지 않고 오류로 드러낸다
function toModelId(model: string): ModelId {
  if (!isModelId(model)) throw new Error("알 수 없는 모델 id");
  return model;
}

// url: PNG 원본(다운로드), thumbUrl: 목록용 썸네일, previewUrl: 화면용 WebP
export function imageUrls(id: string): { url: string; thumbUrl: string; previewUrl: string } {
  const file = (kind: StorageKind) => `/api/files/${storageKey(kind, id)}`;
  return { url: file("images"), thumbUrl: file("thumbs"), previewUrl: file("previews") };
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
    deletedAt: i.deletedAt?.toISOString() ?? null,
  };
}

// 휴지통 이미지는 화면에서 없는 것으로 다룬다(행은 남아 복구할 수 있다)
function liveImage(i: Image | null): ImageDto | null {
  return i && !i.deletedAt ? toImageDto(i) : null;
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
    inputImage: liveImage(j.inputImage),
    image: liveImage(j.image),
    createdAt: j.createdAt.toISOString(),
  };
}

// 휴지통 대화는 없는 것으로 다룬다(404)
export async function getConversationDetail(id: string): Promise<{ conversation: Conversation; jobs: JobWithImages[] } | null> {
  const conversation = await prisma.conversation.findUnique({ where: { id } });
  if (!conversation || conversation.deletedAt) return null;
  // 최신 DETAIL_JOB_LIMIT 개를 가져와 오래된 순으로 돌려준다
  const recent = await prisma.job.findMany({
    where: { conversationId: id },
    include: jobInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: DETAIL_JOB_LIMIT,
  });
  return { conversation, jobs: recent.reverse() };
}

// 주어진 id 의 잡만 DB 에서 다시 읽어 같은 자리에 끼운다(나머지는 그대로)
export async function reloadJobs(jobs: JobWithImages[], ids: Iterable<string>): Promise<JobWithImages[]> {
  const fresh = await prisma.job.findMany({ where: { id: { in: [...ids] } }, include: jobInclude });
  const byId = new Map(fresh.map((j) => [j.id, j]));
  return jobs.map((j) => byId.get(j.id) ?? j);
}

export function toConversationDto(c: Conversation, thumbImageId: string | null): ConversationDto {
  return {
    id: c.id,
    title: c.title,
    model: toModelId(c.model),
    thumbUrl: thumbImageId ? imageUrls(thumbImageId).thumbUrl : null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    deletedAt: c.deletedAt?.toISOString() ?? null,
  };
}

export function toConversationDetailDto(c: Conversation, jobs: JobWithImages[], worker: WorkerState): ConversationDetailDto {
  const latestImage = [...jobs].reverse().find((j) => j.image && !j.image.deletedAt)?.image ?? null;
  return { ...toConversationDto(c, latestImage?.id ?? null), jobs: jobs.map(toJobDto), worker };
}

export async function listConversations(limit: number): Promise<ConversationDto[]> {
  // 썸네일은 대화마다 최신 생성·고침 이미지 하나(관계 include 로 한 번에 가져온다). 휴지통 대화·이미지는 뺀다
  const rows = await prisma.conversation.findMany({
    where: { deletedAt: null },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit,
    include: { images: { where: { kind: { not: "UPLOADED" }, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true } } },
  });
  return rows.map((r) => toConversationDto(r, r.images[0]?.id ?? null));
}
