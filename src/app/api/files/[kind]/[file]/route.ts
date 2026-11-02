import { ApiError, handleRoute } from "@/lib/api/errors";
import { isStorageKind, readFile, resolveStoragePath, type StorageKind, storageKey } from "@/lib/storage";

const CONTENT_TYPE = { images: "image/png", thumbs: "image/webp", previews: "image/webp" } as const;

// 저장된 파일. 없으면 null
async function readStored(kind: StorageKind, id: string): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    return await readFile(storageKey(kind, id));
  } catch (e) {
    if ((e as { code?: string }).code === "ENOENT") return null;
    throw e;
  }
}

// GET /api/files/images/<id>.png · thumbs/<id>.webp · previews/<id>.webp — 저장된 파일 서빙. 파일 이름은 id 라 바뀌지 않는다
export const GET = handleRoute("files.get", async (_req, ctx) => {
  const { kind, file } = await ctx.params;
  if (!isStorageKind(kind) || !resolveStoragePath(kind, file)) throw new ApiError(404, "not_found");
  const id = file.slice(0, file.lastIndexOf("."));
  let served: StorageKind = kind;
  let data = await readStored(kind, id);
  // 화면용 미리보기가 생기기 전에 저장된 이미지는 원본 PNG 로 대신한다
  if (!data && kind === "previews") {
    served = "images";
    data = await readStored("images", id);
  }
  if (!data) throw new ApiError(404, "not_found");
  return new Response(data, {
    headers: {
      "Content-Type": CONTENT_TYPE[served],
      "Content-Length": String(data.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
});
