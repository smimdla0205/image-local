"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CircleAlertIcon, EllipsisIcon, ImagesIcon, Link2Icon, Trash2Icon, Undo2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ICON_BUTTON_CLASS } from "@/components/chat/styles";
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
import { apiFetch, errorMessage } from "@/lib/api-client";
import type { ConversationDetailDto, ConversationListDto } from "@/lib/jobs/schemas";
import { queryKeys } from "@/lib/query-keys";

type Props = {
  id: string;
  title: string | null;
  counts: ConversationDetailDto["counts"];
  // 지우는 동안 대화 폴링을 멈춘다(지운 대화를 다시 불러 404 가 나지 않게)
  onDeletingChange: (deleting: boolean) => void;
};

function Fact({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  );
}

// 대화 메뉴: 대화 삭제(확인 뒤 휴지통으로. 토스트의 되돌리기로 바로 복구)
export function ConversationMenu({ id, title, counts, onDeletingChange }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.images.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.trash.all });
  }

  async function restore() {
    try {
      await apiFetch(`/api/conversations/${id}/restore`, { method: "POST" });
      invalidate();
      toast.success("복구했어요");
      router.push(`/c/${id}`);
    } catch (e) {
      toast.error(errorMessage(e, "복구하지 못했어요. 휴지통에서 다시 시도해 주세요."));
    }
  }

  async function handleDelete() {
    setBusy(true);
    onDeletingChange(true);
    await queryClient.cancelQueries({ queryKey: queryKeys.conversations.detail(id) });
    try {
      await apiFetch(`/api/conversations/${id}`, { method: "DELETE" });
    } catch (e) {
      onDeletingChange(false);
      setBusy(false);
      toast.error(errorMessage(e, "대화를 삭제하지 못했어요. 다시 시도해 주세요."));
      return;
    }
    setBusy(false);
    setOpen(false);
    // 사이드바에서 바로 빼고(새로 받기 전), 지운 대화의 상세·이미지 캐시는 버린다
    queryClient.setQueryData<ConversationListDto>(queryKeys.conversations.list(), (old) => (old ? { items: old.items.filter((c) => c.id !== id) } : old));
    queryClient.removeQueries({ queryKey: queryKeys.conversations.detail(id) });
    invalidate();
    router.push("/");
    toast.success("휴지통으로 옮겼어요", { action: { label: "되돌리기", onClick: () => void restore() } });
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
      <AlertDialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>휴지통으로 옮길까요?</AlertDialogTitle>
            <AlertDialogDescription className="truncate">{title ?? "대화"}</AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="flex flex-col gap-1 text-body">
            {counts.images > 0 && (
              <Fact icon={<ImagesIcon />}>
                이미지 <span className="tabular-nums">{counts.images}</span>장도 함께 옮겨요
              </Fact>
            )}
            {counts.activeJobs > 0 && (
              <Fact icon={<CircleAlertIcon />}>
                진행 중 <span className="tabular-nums">{counts.activeJobs}</span>건을 중단해요
              </Fact>
            )}
            {counts.linkedConversations > 0 && (
              <Fact icon={<Link2Icon />}>
                다른 대화 <span className="tabular-nums">{counts.linkedConversations}</span>건이 이 대화의 이미지를 원본으로 써요
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
    </>
  );
}
