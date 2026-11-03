// 휴지통. 삭제는 deletedAt 만 찍고 파일은 남긴다. 비우기·만료 때만 행과 파일을 지운다
import type { Conversation, Image, Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/db";
import { getWorkerClient } from "@/lib/gpu/client";
import { toConversationDto, toImageDto } from "@/lib/jobs/queries";
import type { TrashDto } from "@/lib/jobs/schemas";
import { staleUploadCutoff, trashCutoff, trashExpiresAt } from "@/lib/jobs/trash-ttl";
import { ACTIVE_STATUSES } from "@/lib/jobs/transitions";
import { deleteImageFiles } from "@/lib/storage";

export type Trashed = { id: string; deletedAt: Date };

// 대화와 그 이미지를 같은 시각으로 휴지통에 넣고 진행 중인 잡은 전부 취소한다(제출 여부와 무관). 이미 휴지통이면 그대로
export async function trashConversation(id: string): Promise<Trashed | null> {
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.findUnique({ where: { id }, select: { deletedAt: true } });
    if (!conversation) return null;
    if (conversation.deletedAt) return { deletedAt: conversation.deletedAt, cancel: [] as string[] };
    const active = await tx.job.findMany({ where: { conversationId: id, status: { in: ACTIVE_STATUSES } }, select: { id: true } });
    await tx.job.updateMany({ where: { conversationId: id, status: { in: ACTIVE_STATUSES } }, data: { status: "CANCELLED" } });
    await tx.image.updateMany({ where: { conversationId: id, deletedAt: null }, data: { deletedAt: now } });
    await tx.conversation.update({ where: { id }, data: { deletedAt: now } });
    return { deletedAt: now, cancel: active.map((j) => j.id) };
  });
  if (!result) return null;
  // 워커 취소는 정리 작업이라 실패(워커 불통·아직 미제출이라 404)해도 삭제를 막지 않는다. DB 가 CANCELLED 라 늦게 온 결과는 버려진다
  const client = getWorkerClient();
  await Promise.allSettled(result.cancel.map((jobId) => client.cancelJob(jobId)));
  return { id, deletedAt: result.deletedAt };
}

// 대화와 함께 옮겨진 이미지(같은 deletedAt)만 같이 돌아온다. 먼저 따로 지운 이미지는 휴지통에 남는다
export async function restoreConversation(id: string): Promise<Conversation | null> {
  return prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.findUnique({ where: { id } });
    if (!conversation) return null;
    if (!conversation.deletedAt) return conversation;
    await tx.image.updateMany({ where: { conversationId: id, deletedAt: conversation.deletedAt }, data: { deletedAt: null } });
    return tx.conversation.update({ where: { id }, data: { deletedAt: null } });
  });
}

export async function trashImage(id: string): Promise<Trashed | null> {
  const image = await prisma.image.findUnique({ where: { id }, select: { deletedAt: true } });
  if (!image) return null;
  if (image.deletedAt) return { id, deletedAt: image.deletedAt };
  const now = new Date();
  await prisma.image.update({ where: { id }, data: { deletedAt: now } });
  return { id, deletedAt: now };
}

// 대화가 휴지통에 있으면 이미지만 먼저 돌릴 수 없다(대화를 복구하면 같이 돌아온다)
export async function restoreImage(id: string): Promise<Image | null> {
  const image = await prisma.image.findUnique({ where: { id }, select: { conversation: { select: { deletedAt: true } } } });
  if (!image) return null;
  if (image.conversation?.deletedAt) throw new ApiError(409, "conversation_in_trash");
  return prisma.image.update({ where: { id }, data: { deletedAt: null } });
}

const TRASH_LIST_LIMIT = 200;

// 휴지통 목록. 대화는 그 안의 이미지 수와 함께, 이미지는 대화가 휴지통이 아닌 것만 따로 보인다(올린 사진은 보이지 않는다)
export async function listTrash(): Promise<TrashDto> {
  const [conversations, images] = await Promise.all([
    prisma.conversation.findMany({
      where: { deletedAt: { not: null } },
      orderBy: [{ deletedAt: "desc" }, { id: "desc" }],
      take: TRASH_LIST_LIMIT,
      include: {
        _count: { select: { images: { where: { deletedAt: { not: null }, kind: { not: "UPLOADED" } } } } },
        images: { where: { kind: { not: "UPLOADED" } }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
      },
    }),
    prisma.image.findMany({
      where: { deletedAt: { not: null }, kind: { not: "UPLOADED" }, OR: [{ conversationId: null }, { conversation: { deletedAt: null } }] },
      orderBy: [{ deletedAt: "desc" }, { id: "desc" }],
      take: TRASH_LIST_LIMIT,
    }),
  ]);
  return {
    conversations: conversations.map((c) => ({
      ...toConversationDto(c, c.images[0]?.id ?? null),
      deletedAt: c.deletedAt!.toISOString(),
      expiresAt: trashExpiresAt(c.deletedAt!).toISOString(),
      imageCount: c._count.images,
    })),
    images: images.map((i) => ({ ...toImageDto(i), deletedAt: i.deletedAt!.toISOString(), expiresAt: trashExpiresAt(i.deletedAt!).toISOString() })),
  };
}

export type PurgeOptions = { conversationIds?: string[]; imageIds?: string[]; before?: Date };

// 휴지통 항목을 영구 삭제한다. id 를 주면 그것만, 안 주면 전부(before 가 있으면 그보다 먼저 옮긴 것만).
// 행을 먼저 지우고(잡·이미지는 cascade) 파일은 그다음에 지운다
export async function purgeTrash(opts: PurgeOptions): Promise<{ conversations: number; images: number }> {
  const all = !opts.conversationIds && !opts.imageIds;
  const deletedAt: Prisma.DateTimeNullableFilter = opts.before ? { not: null, lte: opts.before } : { not: null };
  const conversations =
    all || opts.conversationIds
      ? await prisma.conversation.findMany({
          where: { deletedAt, ...(opts.conversationIds ? { id: { in: opts.conversationIds } } : {}) },
          select: { id: true, images: { select: { id: true } } },
        })
      : [];
  const conversationIds = conversations.map((c) => c.id);
  const images =
    all || opts.imageIds
      ? await prisma.image.findMany({
          where: { deletedAt, ...(opts.imageIds ? { id: { in: opts.imageIds } } : {}), ...(conversationIds.length ? { conversationId: { notIn: conversationIds } } : {}) },
          select: { id: true },
        })
      : [];
  const fileIds = [...conversations.flatMap((c) => c.images.map((i) => i.id)), ...images.map((i) => i.id)];
  await prisma.$transaction([
    prisma.conversation.deleteMany({ where: { id: { in: conversationIds } } }),
    prisma.image.deleteMany({ where: { id: { in: images.map((i) => i.id) } } }),
  ]);
  await Promise.all(fileIds.map((id) => deleteImageFiles(id)));
  return { conversations: conversations.length, images: fileIds.length };
}

export async function purgeExpired(now = new Date()): Promise<{ conversations: number; images: number }> {
  return purgeTrash({ before: trashCutoff(now) });
}

// 대화에 붙지 않은 채 오래된 업로드(칩에서 뺐거나 보내지 않은 사진)를 지운다
export async function purgeStaleUploads(now = new Date()): Promise<number> {
  const rows = await prisma.image.findMany({ where: { kind: "UPLOADED", conversationId: null, createdAt: { lt: staleUploadCutoff(now) } }, select: { id: true } });
  if (rows.length === 0) return 0;
  await prisma.image.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  await Promise.all(rows.map((r) => deleteImageFiles(r.id)));
  return rows.length;
}
