"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlertIcon, GitBranchIcon, Trash2Icon, Undo2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Fact } from "@/components/fact";
import { FadeImage } from "@/components/fade-image";
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
import { apiFetch, errorMessage } from "@/lib/api-client";
import { getModel } from "@/lib/gpu/models";
import type { ImageDto, ImageRefsDto } from "@/lib/jobs/schemas";
import { queryKeys } from "@/lib/query-keys";
import { invalidateAfterTrash, restoreFromTrash } from "@/lib/trash-client";

type Props = {
  // null 이면 닫힌 상태
  image: ImageDto | null;
  onOpenChange: (open: boolean) => void;
  // 휴지통으로 옮긴 직후(캐시 무효화 전)에 부른다. 뷰어 닫기·고칠 이미지 칩 빼기처럼 지운 id 를 더 쓰지 않게 하는 일에 쓴다
  onDeleted?: (id: string) => void;
};

// 이미지 삭제 확인창. 결과 카드·갤러리 타일·뷰어가 같이 쓴다. 지우면 휴지통으로 가고 토스트의 되돌리기로 바로 복구한다
export function ImageDeleteDialog({ image, onOpenChange, onDeleted }: Props) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const id = image?.id ?? "";
  const refs = useQuery({
    queryKey: queryKeys.images.refs(id),
    queryFn: () => apiFetch<ImageRefsDto>(`/api/images/${id}/refs`),
    enabled: image !== null,
  });
  const spec = image?.model ? getModel(image.model) : null;

  async function restore(imageId: string) {
    try {
      await restoreFromTrash("image", imageId);
      invalidateAfterTrash(queryClient);
      toast.success("복구했어요");
    } catch (e) {
      toast.error(errorMessage(e, "복구하지 못했어요. 휴지통에서 다시 시도해 주세요."));
    }
  }

  async function handleDelete() {
    if (!image) return;
    const imageId = image.id;
    setBusy(true);
    try {
      await apiFetch(`/api/images/${imageId}`, { method: "DELETE" });
    } catch (e) {
      // 확인창은 그대로 두고 알린다(다시 누르거나 취소할 수 있게)
      toast.error(errorMessage(e, "이미지를 삭제하지 못했어요. 다시 시도해 주세요."));
      setBusy(false);
      return;
    }
    setBusy(false);
    onOpenChange(false);
    onDeleted?.(imageId);
    // 단건 캐시는 버린다(남아 있으면 주소로 다시 열 때 지운 이미지가 보인다). 다시 받지는 않으므로 404 가 나지 않는다
    queryClient.removeQueries({ queryKey: queryKeys.images.detail(imageId) });
    invalidateAfterTrash(queryClient);
    toast.success("휴지통으로 옮겼어요", { action: { label: "되돌리기", onClick: () => void restore(imageId) } });
  }

  return (
    <AlertDialog open={image !== null} onOpenChange={(open) => !busy && onOpenChange(open)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>이미지를 삭제할까요?</AlertDialogTitle>
          {image && (
            <div className="flex items-center gap-3">
              <span className="image-frame size-12 shrink-0 overflow-hidden rounded-sm bg-muted">
                <FadeImage src={image.thumbUrl} alt="" width={48} height={48} className="size-full object-cover" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-label">{image.prompt ?? "올린 사진"}</span>
                <span className="block text-caption text-muted-foreground">
                  버전 {image.version}
                  {spec ? ` · ${spec.name}` : ""}
                </span>
              </span>
            </div>
          )}
          <AlertDialogDescription className="sr-only">삭제하면 휴지통으로 가요.</AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="flex flex-col gap-1 text-body">
          {refs.data && refs.data.children > 0 && (
            <Fact icon={<GitBranchIcon />}>
              고친 버전 <span className="tabular-nums">{refs.data.children}</span>개의 원본 연결이 끊겨요
            </Fact>
          )}
          {refs.data && refs.data.inputFor > 0 && (
            <Fact icon={<CircleAlertIcon />}>
              이 이미지로 만든 요청 <span className="tabular-nums">{refs.data.inputFor}</span>건은 다시 생성할 수 없어요
            </Fact>
          )}
          <Fact icon={<Undo2Icon />}>30일 안에 휴지통에서 복구할 수 있어요</Fact>
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={busy} onClick={handleDelete}>
            <Trash2Icon aria-hidden="true" />
            {busy ? "삭제하는 중…" : "삭제"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
