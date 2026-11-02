import { ApiError, handleRoute } from "@/lib/api/errors";
import { prisma } from "@/lib/db";
import { getWorkerClient } from "@/lib/gpu/client";
import { getConversationDetail, toConversationDetailDto } from "@/lib/jobs/queries";
import { syncJobs } from "@/lib/jobs/sync";
import { ACTIVE_STATUSES } from "@/lib/jobs/transitions";
import { deleteImageFiles } from "@/lib/storage";

// GET /api/conversations/[id] — 대화와 잡(최근 100개). 응답 전에 진행 중인 잡을 워커와 맞춘다(폴링)
export const GET = handleRoute("conversations.get", async (_req, ctx) => {
  const { id } = await ctx.params;
  const detail = await getConversationDetail(id);
  if (!detail) throw new ApiError(404, "conversation_not_found");
  const synced = await syncJobs(detail.jobs);
  return Response.json(toConversationDetailDto(detail.conversation, synced.jobs, synced.worker));
});

// DELETE /api/conversations/[id] — 확인 뒤 바로 영구 삭제. 진행 중인 잡은 워커에서 취소하고 이미지 파일도 지운다
export const DELETE = handleRoute("conversations.delete", async (_req, ctx) => {
  const { id } = await ctx.params;
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      jobs: { where: { status: { in: ACTIVE_STATUSES }, submittedAt: { not: null } }, select: { id: true } },
      images: { select: { id: true } },
    },
  });
  if (!conversation) throw new ApiError(404, "conversation_not_found");

  const client = getWorkerClient();
  // 워커 취소는 정리 작업이라 실패해도 삭제를 막지 않는다(워커 쪽 결과는 버려진다). 한꺼번에 보낸다
  await Promise.allSettled(conversation.jobs.map((job) => client.cancelJob(job.id)));
  // 행을 먼저 지우고(잡·이미지는 cascade) 파일은 그다음에 지운다. 파일 삭제가 실패해도 행은 남지 않는다
  await prisma.conversation.delete({ where: { id } });
  await Promise.all(conversation.images.map((img) => deleteImageFiles(img.id)));
  return Response.json({ id });
});
