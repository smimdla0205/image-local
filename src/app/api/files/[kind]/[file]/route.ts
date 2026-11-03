import { ApiError, handleRoute } from "@/lib/api/errors";
import { makePreview } from "@/lib/images/normalize";
import { isStorageKind, putFile, readFileIfExists, resolveStoragePath, storageKey } from "@/lib/storage";

const CONTENT_TYPE = { images: "image/png", thumbs: "image/webp", previews: "image/webp" } as const;

// GET /api/files/images/<id>.png · thumbs/<id>.webp · previews/<id>.webp — 저장된 파일 서빙. 파일 이름은 id 라 바뀌지 않는다
export const GET = handleRoute("files.get", async (_req, ctx) => {
  const { kind, file } = await ctx.params;
  if (!isStorageKind(kind) || !resolveStoragePath(kind, file)) throw new ApiError(404, "not_found");
  const id = file.slice(0, file.lastIndexOf("."));
  let data = await readFileIfExists(storageKey(kind, id));
  // 화면용 미리보기가 생기기 전에 저장된 이미지는 처음 요청할 때 원본으로 만들어 둔다(다음부터는 저장된 파일)
  if (!data && kind === "previews") {
    const png = await readFileIfExists(storageKey("images", id));
    if (png) {
      data = (await makePreview(png)) as Uint8Array<ArrayBuffer>;
      await putFile(storageKey("previews", id), data);
    }
  }
  if (!data) throw new ApiError(404, "not_found");
  return new Response(data, {
    headers: {
      "Content-Type": CONTENT_TYPE[kind],
      "Content-Length": String(data.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
});
