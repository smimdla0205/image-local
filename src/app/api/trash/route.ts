import { handleRoute, parseJsonBody } from "@/lib/api/errors";
import { purgeBodySchema } from "@/lib/jobs/schemas";
import { listTrash, purgeExpired, purgeStaleUploads, purgeTrash } from "@/lib/jobs/trash";

// GET /api/trash — 휴지통 목록. 보기 전에 30일 지난 항목과 24시간 넘게 대화에 붙지 않은 업로드를 먼저 지운다
export const GET = handleRoute("trash.list", async () => {
  await purgeExpired();
  await purgeStaleUploads();
  return Response.json(await listTrash());
});

// DELETE /api/trash — 영구 삭제. 본문 없이 보내면 전부, { conversationIds, imageIds, before } 로 범위를 좁힌다
export const DELETE = handleRoute("trash.purge", async (req) => {
  const body = req.headers.get("content-type") ? await parseJsonBody(req, purgeBodySchema) : {};
  const result = await purgeTrash({ ...body, before: body.before ? new Date(body.before) : undefined });
  return Response.json(result);
});
