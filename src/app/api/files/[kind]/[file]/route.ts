import { ApiError, handleRoute } from "@/lib/api/errors";
import { isStorageKind, readFile, resolveStoragePath, storageKey } from "@/lib/storage";

const CONTENT_TYPE = { images: "image/png", thumbs: "image/webp" } as const;

// GET /api/files/images/<id>.png · /api/files/thumbs/<id>.webp — 저장된 파일 서빙. 파일 이름은 id 라 바뀌지 않는다
export const GET = handleRoute("files.get", async (_req, ctx) => {
  const { kind, file } = await ctx.params;
  if (!isStorageKind(kind) || !resolveStoragePath(kind, file)) throw new ApiError(404, "not_found");
  const id = file.slice(0, file.lastIndexOf("."));
  let data: Uint8Array<ArrayBuffer>;
  try {
    data = await readFile(storageKey(kind, id));
  } catch (e) {
    if ((e as { code?: string }).code === "ENOENT") throw new ApiError(404, "not_found");
    throw e;
  }
  return new Response(data, {
    headers: {
      "Content-Type": CONTENT_TYPE[kind],
      "Content-Length": String(data.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
});
