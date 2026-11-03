"use client";

import { ImageOffIcon, Undo2Icon } from "lucide-react";

import { DANGER_TEXT } from "@/components/chat/styles";
import { FadeImage } from "@/components/fade-image";
import { Button } from "@/components/ui/button";
import { getModel } from "@/lib/gpu/models";
import type { TrashConversationDto, TrashImageDto } from "@/lib/jobs/schemas";

export type TrashItem = { kind: "conversation"; item: TrashConversationDto } | { kind: "image"; item: TrashImageDto };

const DAY_MS = 24 * 60 * 60 * 1000;

// 자동으로 지워질 때까지 남은 날. 당일은 D-0
export function daysLeft(expiresAt: string, now: Date): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / DAY_MS));
}

function describe(entry: TrashItem): { title: string; meta: string; thumbUrl: string | null } {
  if (entry.kind === "conversation") {
    const c = entry.item;
    return { title: c.title ?? "대화", meta: `대화 · 이미지 ${c.imageCount}장`, thumbUrl: c.thumbUrl };
  }
  const i = entry.item;
  const model = i.model ? getModel(i.model).shortName : "올린 사진";
  return { title: i.prompt ?? "올린 사진", meta: `이미지 · ${model} · 버전 ${i.version}`, thumbUrl: i.thumbUrl };
}

type Props = {
  entry: TrashItem;
  now: Date;
  busy: boolean;
  onRestore: (entry: TrashItem) => void;
  onPurge: (entry: TrashItem) => void;
};

// 휴지통 한 줄: 썸네일, 제목, 종류·개수, 남은 날, 복구·영구 삭제
export function TrashRow({ entry, now, busy, onRestore, onPurge }: Props) {
  const { title, meta, thumbUrl } = describe(entry);
  return (
    <li className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-secondary">
      {thumbUrl ? (
        <span className="image-frame size-12 shrink-0 overflow-hidden rounded-sm bg-muted">
          <FadeImage src={thumbUrl} alt="" width={48} height={48} loading="lazy" className="size-full object-cover" />
        </span>
      ) : (
        <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-sm bg-muted text-muted-foreground">
          <ImageOffIcon className="size-4" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-label">{title}</p>
        <p className="text-caption text-muted-foreground">{meta}</p>
      </div>
      <span className="text-caption text-muted-foreground tabular-nums">D-{daysLeft(entry.item.expiresAt, now)}</span>
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => onRestore(entry)} className="max-md:h-11">
        <Undo2Icon aria-hidden="true" />
        복구
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onPurge(entry)} className={`${DANGER_TEXT} max-md:h-11`}>
        영구 삭제
      </Button>
    </li>
  );
}
