"use client";

import { CopyIcon, DownloadIcon, PencilIcon, Trash2Icon, WandSparklesIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { DANGER_TEXT } from "@/components/chat/composer-options";
import { StepMeter } from "@/components/chat/step-meter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { getModel, isModelId } from "@/lib/gpu/models";
import type { ImageDto } from "@/lib/jobs/schemas";

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error("복사하지 못했어요");
  }
}

// 뷰어 오른쪽 정보: 프롬프트, 모델·방식·step·크기·시드·라이선스, 다운로드·고치기·삭제(확인 뒤 영구 삭제)
export function ViewerPanel({ image, onDelete }: { image: ImageDto; onDelete: () => Promise<void> }) {
  const spec = isModelId(image.model) ? getModel(image.model) : null;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    try {
      await onDelete();
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className="text-label">프롬프트</h3>
        <p className="max-h-48 overflow-y-auto text-body whitespace-pre-wrap">{image.prompt ?? "올린 사진이에요"}</p>
        {image.prompt && (
          <Button type="button" variant="ghost" size="sm" className="self-start max-md:h-11" onClick={() => copy(image.prompt ?? "", "프롬프트를 복사했어요")}>
            <CopyIcon aria-hidden="true" />
            프롬프트 복사
          </Button>
        )}
      </section>

      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-caption">
        <dt className="text-muted-foreground">모델</dt>
        <dd>{spec?.name ?? "올린 사진"}</dd>
        <dt className="text-muted-foreground">방식</dt>
        <dd>{image.kind === "EDITED" ? "이어서 고치기" : image.kind === "UPLOADED" ? "올린 사진" : "텍스트→이미지"}</dd>
        {image.steps !== null && (
          <>
            <dt className="text-muted-foreground">step</dt>
            <dd className="inline-flex items-center gap-1.5 tabular-nums">
              <StepMeter total={image.steps} step={0} variant="inline" />
              {image.steps} step
            </dd>
          </>
        )}
        <dt className="text-muted-foreground">크기</dt>
        <dd className="tabular-nums">
          {image.width} × {image.height}
        </dd>
        {image.seed !== null && (
          <>
            <dt className="text-muted-foreground">시드</dt>
            <dd className="flex items-center gap-1 tabular-nums">
              {image.seed}
              <Button type="button" variant="ghost" size="icon-xs" aria-label="시드 복사" className="max-md:size-11" onClick={() => copy(String(image.seed), "시드를 복사했어요")}>
                <CopyIcon aria-hidden="true" />
              </Button>
            </dd>
          </>
        )}
        {spec && (
          <>
            <dt className="text-muted-foreground">라이선스</dt>
            <dd className="flex flex-col">
              <span>{spec.license.name}</span>
              {spec.license.note && <span className="text-muted-foreground">{spec.license.note}</span>}
            </dd>
          </>
        )}
      </dl>

      <div className="flex flex-wrap gap-2">
        <a href={image.url} download={`imagen-${image.id}.png`} className={buttonVariants({ variant: "outline", className: "max-md:h-11" })}>
          <DownloadIcon aria-hidden="true" />
          다운로드
        </a>
        {spec?.canEdit && image.conversationId && (
          <Link href={`/c/${image.conversationId}?target=${image.id}`} className={buttonVariants({ variant: "outline", className: "max-md:h-11" })}>
            <PencilIcon aria-hidden="true" />
            이어서 고치기
          </Link>
        )}
        {spec && !spec.canEdit && (
          <Link href={`/?edit=${image.id}`} className={buttonVariants({ variant: "outline", className: "max-md:h-11" })}>
            <WandSparklesIcon aria-hidden="true" />
            다른 모델로 고치기
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <Button type="button" variant="outline" className={`${DANGER_TEXT} max-md:h-11`} onClick={() => setConfirmOpen(true)}>
          <Trash2Icon aria-hidden="true" />
          삭제
        </Button>
        <span className="text-caption text-muted-foreground">삭제하면 되돌릴 수 없어요</span>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이미지를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>삭제하면 되돌릴 수 없어요.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction variant="outline" disabled={busy} onClick={handleDelete} className={DANGER_TEXT}>
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
