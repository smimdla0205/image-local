import { ApiError, handleRoute } from "@/lib/api/errors";
import { toImageDto } from "@/lib/jobs/queries";
import { restoreImage } from "@/lib/jobs/trash";

// POST /api/images/[id]/restore — 휴지통에서 되돌린다. 대화가 휴지통이면 409
export const POST = handleRoute("images.restore", async (_req, ctx) => {
  const { id } = await ctx.params;
  const image = await restoreImage(id);
  if (!image) throw new ApiError(404, "image_not_found");
  return Response.json(toImageDto(image));
});
