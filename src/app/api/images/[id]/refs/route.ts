import { ApiError, handleRoute } from "@/lib/api/errors";
import { prisma } from "@/lib/db";

// GET /api/images/[id]/refs — 이 이미지를 원본으로 둔 고친 버전 수와 입력으로 쓴 요청 수(삭제 확인창이 보여 준다)
export const GET = handleRoute("images.refs", async (_req, ctx) => {
  const { id } = await ctx.params;
  const [image, children, inputFor] = await Promise.all([
    prisma.image.findUnique({ where: { id }, select: { id: true } }),
    prisma.image.count({ where: { parentId: id, deletedAt: null } }),
    prisma.job.count({ where: { inputImageId: id } }),
  ]);
  if (!image) throw new ApiError(404, "image_not_found");
  return Response.json({ children, inputFor });
});
