import { handleRoute } from "@/lib/api/errors";
import { prisma } from "@/lib/db";
import { toImageDto } from "@/lib/jobs/queries";
import { imageListQuerySchema } from "@/lib/jobs/schemas";

// GET /api/images?cursor&limit&model&q — 갤러리. 만든·고친 이미지만(올린 사진 제외), 최신순, 커서로 넘긴다
export const GET = handleRoute("images.list", async (req) => {
  const { cursor, limit, model, q } = imageListQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  // 다음 페이지가 있는지 알려고 하나 더 가져온다
  const rows = await prisma.image.findMany({
    where: { kind: { in: ["GENERATED", "EDITED"] }, deletedAt: null, ...(model ? { model } : {}), ...(q ? { prompt: { contains: q } } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const items = rows.slice(0, limit);
  return Response.json({ items: items.map(toImageDto), nextCursor: rows.length > limit ? items[items.length - 1].id : null });
});
