"use client";

import { CircleAlertIcon, XIcon } from "lucide-react";

import { ICON_BUTTON_CLASS } from "@/components/chat/styles";
import { FadeImage } from "@/components/fade-image";
import { Skeleton } from "@/components/ui/skeleton";
import type { ImageDto } from "@/lib/jobs/schemas";

// 고칠 이미지(입력창 위). label: '버전 n' | '올린 사진'
export type ComposerTarget = { imageId: string; thumbUrl: string; width: number; height: number; label: string };

export function toTarget(img: ImageDto): ComposerTarget {
  return { imageId: img.id, thumbUrl: img.thumbUrl, width: img.width, height: img.height, label: img.kind === "UPLOADED" ? "올린 사진" : `버전 ${img.version}` };
}

// 고칠 이미지를 받거나 올리는 동안 같은 자리에 둔다. label: '올리는 중…' | '불러오는 중…'
export function TargetChipSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className="flex items-center gap-3 rounded-md bg-muted p-1 pr-2">
      <Skeleton className="size-12 shrink-0 rounded-sm bg-secondary" />
      <p className="text-label text-muted-foreground">{label}</p>
    </div>
  );
}

// 고칠 이미지를 못 찾았을 때(주소의 ?edit= 가 지워진 이미지·잘못된 id). 닫으면 사라진다
export function TargetChipNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded-md bg-muted p-2 pl-3">
      <CircleAlertIcon aria-hidden="true" className="size-4 shrink-0 text-destructive" />
      <p className="min-w-0 flex-1 text-label">{message}</p>
      <button type="button" aria-label="닫기" onClick={onDismiss} className={ICON_BUTTON_CLASS}>
        <XIcon aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

export function TargetChip({ target, onRemove }: { target: ComposerTarget; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-muted p-1 pr-2">
      <span className="image-frame size-12 shrink-0 overflow-hidden rounded-sm bg-muted">
        <FadeImage src={target.thumbUrl} alt="" width={48} height={48} className="size-full object-cover" />
      </span>
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
