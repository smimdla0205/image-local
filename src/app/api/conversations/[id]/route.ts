import { ApiError, handleRoute } from "@/lib/api/errors";
import { getConversationDetail, toConversationDetailDto } from "@/lib/jobs/queries";
import { syncJobs } from "@/lib/jobs/sync";
import { trashConversation } from "@/lib/jobs/trash";

// GET /api/conversations/[id] — 대화와 잡(최근 100개). 응답 전에 진행 중인 잡을 워커와 맞춘다(폴링). 휴지통 대화는 404
export const GET = handleRoute("conversations.get", async (_req, ctx) => {
  const { id } = await ctx.params;
  const detail = await getConversationDetail(id);
  if (!detail) throw new ApiError(404, "conversation_not_found");
  const synced = await syncJobs(detail.jobs);
  return Response.json(toConversationDetailDto(detail.conversation, synced.jobs, synced.worker));
});

// DELETE /api/conversations/[id] — 휴지통으로 옮긴다(이미지도 함께, 진행 중인 잡은 취소). 파일은 비우기·만료 때 지운다
export const DELETE = handleRoute("conversations.delete", async (_req, ctx) => {
  const { id } = await ctx.params;
  const trashed = await trashConversation(id);
  if (!trashed) throw new ApiError(404, "conversation_not_found");
  return Response.json({ id: trashed.id, deletedAt: trashed.deletedAt.toISOString() });
});
