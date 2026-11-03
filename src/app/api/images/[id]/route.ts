import { ApiError, handleRoute } from "@/lib/api/errors";
import { prisma } from "@/lib/db";
import { toImageDto } from "@/lib/jobs/queries";
import { trashImage } from "@/lib/jobs/trash";

// GET /api/images/[id] — 이미지 하나(뷰어). 휴지통 이미지는 404
export const GET = handleRoute("images.get", async (_req, ctx) => {
  const { id } = await ctx.params;
  const image = await prisma.image.findUnique({ where: { id } });
  if (!image || image.deletedAt) throw new ApiError(404, "image_not_found");
  return Response.json(toImageDto(image));
});

// DELETE /api/images/[id] — 휴지통으로 옮긴다. 행이 남으므로 고친 버전의 parentId·요청의 입력 이미지는 그대로이고 응답에서만 비워진다
export const DELETE = handleRoute("images.delete", async (_req, ctx) => {
  const { id } = await ctx.params;
  const trashed = await trashImage(id);
  if (!trashed) throw new ApiError(404, "image_not_found");
  return Response.json({ id: trashed.id, deletedAt: trashed.deletedAt.toISOString() });
});
