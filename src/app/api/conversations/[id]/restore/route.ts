import { ApiError, handleRoute } from "@/lib/api/errors";
import { prisma } from "@/lib/db";
import { toConversationDto } from "@/lib/jobs/queries";
import { restoreConversation } from "@/lib/jobs/trash";

// POST /api/conversations/[id]/restore — 휴지통에서 되돌린다(함께 옮겨진 이미지도)
export const POST = handleRoute("conversations.restore", async (_req, ctx) => {
  const { id } = await ctx.params;
  const conversation = await restoreConversation(id);
  if (!conversation) throw new ApiError(404, "conversation_not_found");
  const thumb = await prisma.image.findFirst({ where: { conversationId: id, kind: { not: "UPLOADED" }, deletedAt: null }, orderBy: { createdAt: "desc" }, select: { id: true } });
  return Response.json(toConversationDto(conversation, thumb?.id ?? null));
});
