"use client";

import { XIcon } from "lucide-react";

import { ICON_BUTTON_CLASS } from "@/components/chat/composer-options";
import type { ImageDto } from "@/lib/jobs/schemas";

// 고칠 이미지(입력창 위). label: '버전 n' | '올린 사진'
export type ComposerTarget = { imageId: string; thumbUrl: string; width: number; height: number; label: string };

export function toTarget(img: ImageDto): ComposerTarget {
  return { imageId: img.id, thumbUrl: img.thumbUrl, width: img.width, height: img.height, label: img.kind === "UPLOADED" ? "올린 사진" : `버전 ${img.version}` };
}

export function TargetChip({ target, onRemove }: { target: ComposerTarget; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-muted p-1 pr-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- 앱이 서빙하는 썸네일(이미 512px WebP)이라 next/image 최적화가 필요 없다 */}
      <img src={target.thumbUrl} alt="" width={48} height={48} className="size-12 shrink-0 rounded-sm object-cover" />
      <div className="min-w-0 flex-1">
        <p className="text-label">고칠 이미지</p>
        <p className="text-caption text-muted-foreground">{target.label}</p>
      </div>
      <button type="button" aria-label="고칠 이미지 빼기" onClick={onRemove} className={ICON_BUTTON_CLASS}>
        <XIcon aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
