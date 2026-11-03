"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlertIcon, GitBranchIcon, Trash2Icon, Undo2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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

type Props = {
  // null 이면 닫힌 상태
  image: ImageDto | null;
  onOpenChange: (open: boolean) => void;
  // 휴지통으로 옮긴 직후(캐시 무효화 전)에 부른다. 뷰어 닫기·고칠 이미지 칩 빼기처럼 지운 id 를 더 쓰지 않게 하는 일에 쓴다
  onDeleted?: (id: string) => void;
};

// 갤러리 목록·대화·휴지통만 새로 받는다. 이미지 단건(뷰어)·참조 수는 지운 id 를 다시 불러 404 가 나지 않게 건드리지 않는다
function invalidateAfterTrash(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.images.lists });
  void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.trash.all });
}

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
      await apiFetch(`/api/images/${imageId}/restore`, { method: "POST" });
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
            <li className="flex items-start gap-2">
              <GitBranchIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>
                고친 버전 <span className="tabular-nums">{refs.data.children}</span>개의 원본 연결이 끊겨요
              </span>
            </li>
          )}
          {refs.data && refs.data.inputFor > 0 && (
            <li className="flex items-start gap-2">
              <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>
                이 이미지로 만든 요청 <span className="tabular-nums">{refs.data.inputFor}</span>건은 다시 생성할 수 없어요
              </span>
            </li>
          )}
          <li className="flex items-start gap-2">
            <Undo2Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>30일 안에 휴지통에서 복구할 수 있어요</span>
          </li>
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
