"use client";

import { useQueryClient } from "@tanstack/react-query";
import { EllipsisIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ICON_BUTTON_CLASS } from "@/components/chat/composer-options";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

type Props = {
  id: string;
  // 지우는 동안 대화 폴링을 멈춘다(지운 대화를 다시 불러 404 가 나지 않게)
  onDeletingChange: (deleting: boolean) => void;
};

// 대화 메뉴: 대화 삭제(확인 뒤 바로 영구 삭제, 되돌리기 없음)
export function ConversationMenu({ id, onDeletingChange }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    onDeletingChange(true);
    await queryClient.cancelQueries({ queryKey: queryKeys.conversations.detail(id) });
    try {
      await apiFetch(`/api/conversations/${id}`, { method: "DELETE" });
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.images.all });
      router.push("/");
    } catch (e) {
      onDeletingChange(false);
      toast.error(e instanceof ApiClientError ? e.message : "대화를 지우지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="대화 메뉴" className={ICON_BUTTON_CLASS}>
          <EllipsisIcon aria-hidden="true" className="size-[18px]" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-36">
          <DropdownMenuItem variant="destructive" onClick={() => setOpen(true)}>
            <Trash2Icon aria-hidden="true" />
            대화 삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>대화를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>이미지도 함께 지워지고 되돌릴 수 없어요.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={busy} onClick={handleDelete}>
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
