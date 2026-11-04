"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DANGER_TEXT } from "@/components/chat/styles";
import { groupByDate } from "@/components/shell/day-groups";
import { Topbar } from "@/components/shell/topbar";
import { type TrashItem, TrashRow } from "@/components/trash/trash-row";
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
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { LoadError } from "@/components/ui/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, errorMessage } from "@/lib/api-client";
import type { TrashDto } from "@/lib/jobs/schemas";
import { queryKeys } from "@/lib/query-keys";
import { invalidateAfterTrash, restoreFromTrash } from "@/lib/trash-client";

function TrashSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      <span className="sr-only">불러오는 중…</span>
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-16" aria-hidden="true" />
      ))}
    </div>
  );
}

// 대화와 이미지를 휴지통에 넣은 순서(최신 먼저)로 한 목록에 섞는다
function mergeEntries(data: TrashDto): TrashItem[] {
  const entries: TrashItem[] = [
    ...data.conversations.map((item) => ({ kind: "conversation", item }) as const),
    ...data.images.map((item) => ({ kind: "image", item }) as const),
  ];
  return entries.sort((a, b) => b.item.deletedAt.localeCompare(a.item.deletedAt));
}

// 휴지통: 지운 대화·이미지를 30일 동안 보관한다. 복구, 하나씩 영구 삭제, 비우기
export function TrashView() {
  const queryClient = useQueryClient();
  const trash = useQuery({ queryKey: queryKeys.trash.all, queryFn: () => apiFetch<TrashDto>("/api/trash") });
  const [busy, setBusy] = useState(false);
  const [emptyOpen, setEmptyOpen] = useState(false);

  // 성공하면 true. 실패는 토스트로 알리고 부른 쪽이 화면(확인창)을 유지할 수 있게 false
  async function run(action: () => Promise<unknown>, done: string, failed: string): Promise<boolean> {
    setBusy(true);
    try {
      await action();
      invalidateAfterTrash(queryClient);
      toast.success(done);
      return true;
    } catch (e) {
      toast.error(errorMessage(e, failed));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const handleRestore = (entry: TrashItem) =>
    run(
      () => restoreFromTrash(entry.kind, entry.item.id),
      "복구했어요",
      "복구하지 못했어요. 다시 시도해 주세요.",
    );
  const handlePurge = (entry: TrashItem) =>
    run(
      () => apiFetch("/api/trash", { method: "DELETE", json: entry.kind === "conversation" ? { conversationIds: [entry.item.id] } : { imageIds: [entry.item.id] } }),
      "영구 삭제했어요",
      "삭제하지 못했어요. 다시 시도해 주세요.",
    );
  async function handleEmpty() {
    const ok = await run(() => apiFetch("/api/trash", { method: "DELETE" }), "휴지통을 비웠어요", "비우지 못했어요. 다시 시도해 주세요.");
    if (ok) setEmptyOpen(false);
  }

  const entries = trash.data ? mergeEntries(trash.data) : [];
  const counts = trash.data?.total ?? { conversations: 0, images: 0 };

  let content: React.ReactNode;
  if (trash.isPending) content = <TrashSkeleton />;
  else if (trash.isError) content = <LoadError align="center" message="휴지통을 불러오지 못했어요" onRetry={() => void trash.refetch()} />;
  else if (entries.length === 0)
    content = (
      <Empty className="border py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Trash2Icon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>휴지통이 비어 있어요</EmptyTitle>
          <EmptyDescription>삭제한 대화와 이미지가 30일 동안 여기에 있어요</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  else {
    // 날짜 묶음·남은 날은 데이터가 온 뒤 브라우저 시간으로 계산한다(미리 렌더링에는 시각을 쓰지 않는다)
    const now = new Date();
    content = (
      <div className="flex flex-col gap-6">
        {groupByDate(entries, now, (e) => e.item.deletedAt).map((group) => (
          <section key={group.label} className="flex flex-col gap-2">
            <h2 className="px-3 text-label">{group.label}</h2>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((entry) => (
                <TrashRow key={`${entry.kind}-${entry.item.id}`} entry={entry} now={now} busy={busy} onRestore={handleRestore} onPurge={handlePurge} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  return (
    <>
      <Topbar
        title="휴지통"
        actions={
          <Button type="button" variant="outline" size="sm" disabled={busy || entries.length === 0} onClick={() => setEmptyOpen(true)} className={`${DANGER_TEXT} max-md:h-11`}>
            <Trash2Icon aria-hidden="true" />
            비우기
          </Button>
        }
      />
      <div className="mx-auto flex w-full max-w-205 flex-1 flex-col gap-6 px-4 pt-2 pb-8 sm:px-6">
        <p className="text-caption text-muted-foreground">30일이 지나면 자동으로 삭제돼요</p>
        {content}
      </div>
      <AlertDialog open={emptyOpen} onOpenChange={(open) => !busy && setEmptyOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>휴지통을 비울까요?</AlertDialogTitle>
            <AlertDialogDescription>
              대화 <span className="tabular-nums">{counts.conversations}</span>개와 이미지 <span className="tabular-nums">{counts.images}</span>장이 영구히 삭제돼요
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={busy} onClick={handleEmpty}>
              <Trash2Icon aria-hidden="true" />
              {busy ? "비우는 중…" : "비우기"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
