import { ApiError, handleRoute } from "@/lib/api/errors";
import { prisma } from "@/lib/db";
import { toImageDto } from "@/lib/jobs/queries";
import { deleteFile, storageKey } from "@/lib/storage";

// GET /api/images/[id] — 이미지 하나(뷰어)
export const GET = handleRoute("images.get", async (_req, ctx) => {
  const { id } = await ctx.params;
  const image = await prisma.image.findUnique({ where: { id } });
  if (!image) throw new ApiError(404, "image_not_found");
  return Response.json(toImageDto(image));
});

// DELETE /api/images/[id] — 확인 뒤 바로 영구 삭제. 이 이미지로 고친 버전은 남고 parentId·입력 이미지만 비워진다(SetNull)
export const DELETE = handleRoute("images.delete", async (_req, ctx) => {
  const { id } = await ctx.params;
  const image = await prisma.image.findUnique({ where: { id }, select: { id: true } });
  if (!image) throw new ApiError(404, "image_not_found");
  // 행을 먼저 지우고 파일은 그다음(파일 삭제가 실패해도 깨진 행이 남지 않는다)
  await prisma.image.delete({ where: { id } });
  await Promise.allSettled([deleteFile(storageKey("images", id)), deleteFile(storageKey("thumbs", id))]);
  return Response.json({ id });
});
