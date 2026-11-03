import { randomUUID } from "node:crypto";

import { after } from "next/server";

import { ApiError, handleRoute } from "@/lib/api/errors";
import { prisma } from "@/lib/db";
import { makeVariants, normalizeImage, readImageSize } from "@/lib/images/normalize";
import { toImageDto } from "@/lib/jobs/queries";
import { purgeStaleUploads } from "@/lib/jobs/trash";
import { deleteImageFiles, putImageFiles } from "@/lib/storage";
import { readStreamLimited } from "@/lib/streams";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
// 멀티파트 경계·헤더 여유분. 선언된 크기가 이보다 크면 본문을 읽지 않고 거절한다
const MULTIPART_OVERHEAD = 1024 * 1024;
// 가로세로 비율 상한(긴 변 / 짧은 변)
const MAX_ASPECT = 4;

// 파일 이름·Content-Type 이 아니라 앞부분 바이트로 형식을 가린다
function isSupportedImage(b: Uint8Array): boolean {
  const png = b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const jpeg = b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  const webp = b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  return png || jpeg || webp;
}

// POST /api/uploads — multipart 필드 file 의 사진을 정규화해 저장하고 ImageDto 를 돌려준다
export const POST = handleRoute("uploads.create", async (req) => {
  const maxBody = MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD;
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBody) throw new ApiError(413, "file_too_large");
  // Content-Length 가 없거나(청크) 틀려도 실제로 읽은 양으로 막는다. 멀티파트는 상한 안의 본문만 해석한다
  const raw = await readStreamLimited(req.body, maxBody);
  if (!raw) throw new ApiError(413, "file_too_large");

  let form: FormData;
  try {
    form = await new Response(raw, { headers: { "content-type": req.headers.get("content-type") ?? "" } }).formData();
  } catch {
    // multipart 가 아니거나 본문이 깨졌다
    throw new ApiError(400, "file_required");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "file_required");
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, "file_too_large");

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isSupportedImage(bytes)) throw new ApiError(415, "unsupported_media_type");

  let size: { width: number; height: number };
  try {
    size = await readImageSize(bytes);
  } catch {
    throw new ApiError(400, "invalid_image");
  }
  if (Math.max(size.width, size.height) / Math.min(size.width, size.height) > MAX_ASPECT) {
    throw new ApiError(400, "invalid_image", "가로세로 비율이 너무 커요.");
  }

  let normalized: Awaited<ReturnType<typeof normalizeImage>>;
  let variants: Awaited<ReturnType<typeof makeVariants>>;
  try {
    normalized = await normalizeImage(bytes);
    variants = await makeVariants(normalized.png);
  } catch {
    // 머리말은 읽혔지만 픽셀 데이터가 깨진 경우
    throw new ApiError(400, "invalid_image");
  }

  const id = randomUUID().replaceAll("-", "");
  try {
    await putImageFiles(id, normalized.png, variants.thumb, variants.preview);
    const image = await prisma.image.create({
      data: { id, kind: "UPLOADED", width: normalized.width, height: normalized.height, hasAlpha: normalized.hasAlpha, bytes: normalized.png.length },
    });
    // 대화에 붙지 않은 채 24시간 지난 업로드는 응답을 보낸 뒤 지운다
    after(() => purgeStaleUploads().catch((e: unknown) => console.error("[uploads] gc", (e as { name?: unknown })?.name)));
    return Response.json(toImageDto(image), { status: 201 });
  } catch (e) {
    // 행을 못 만들었으면 파일도 남기지 않는다
    await deleteImageFiles(id);
    throw e;
  }
});
