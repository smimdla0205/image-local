import { handleRoute, parseJsonBody } from "@/lib/api/errors";
import { purgeBodySchema } from "@/lib/jobs/schemas";
import { listTrash, purgeTrash } from "@/lib/jobs/trash";

// GET /api/trash — 휴지통 목록. 읽기만 한다(30일 지난 항목 정리는 삭제·업로드 요청 뒤에 돈다)
export const GET = handleRoute("trash.list", async () => Response.json(await listTrash()));

// DELETE /api/trash — 영구 삭제. 본문 없이 보내면 전부, { conversationIds, imageIds, before } 로 범위를 좁힌다
export const DELETE = handleRoute("trash.purge", async (req) => {
  const body = req.headers.get("content-type") ? await parseJsonBody(req, purgeBodySchema) : {};
  const result = await purgeTrash({ ...body, before: body.before ? new Date(body.before) : undefined });
  return Response.json(result);
});
