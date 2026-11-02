// DB 행 → 응답 DTO 변환과 조회
import type { Image } from "@/generated/prisma/client";
import { isModelId } from "@/lib/gpu/models";
import type { ImageDto } from "@/lib/jobs/schemas";

export function imageUrls(id: string): { url: string; thumbUrl: string } {
  return { url: `/api/files/images/${id}.png`, thumbUrl: `/api/files/thumbs/${id}.webp` };
}

export function toImageDto(i: Image): ImageDto {
  return {
    id: i.id,
    kind: i.kind,
    conversationId: i.conversationId,
    jobId: i.jobId,
    model: isModelId(i.model) ? i.model : null,
    prompt: i.prompt,
    seed: i.seed,
    steps: i.steps,
    width: i.width,
    height: i.height,
    hasAlpha: i.hasAlpha,
    version: i.version,
    parentId: i.parentId,
    ...imageUrls(i.id),
    createdAt: i.createdAt.toISOString(),
  };
}
