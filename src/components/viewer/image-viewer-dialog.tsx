"use client";

import { type InfiniteData, type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { XIcon } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { type CSSProperties, useState } from "react";

import { ICON_BUTTON_CLASS } from "@/components/chat/styles";
import { FadeImage } from "@/components/fade-image";
import { ImageDeleteDialog } from "@/components/image-delete-dialog";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { LoadError } from "@/components/ui/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewerPanel } from "@/components/viewer/viewer-panel";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { parseId, promptAlt } from "@/lib/jobs/constants";
import { findImage } from "@/lib/jobs/find-image";
import type { ConversationDetailDto, ImageDto, ImageListDto } from "@/lib/jobs/schemas";
import { queryKeys } from "@/lib/query-keys";

// 캐시에 있는 갤러리 목록과 대화 상세에서 같은 id 의 이미지를 찾는다
function findCachedImage(queryClient: QueryClient, id: string): ImageDto | undefined {
  for (const [, data] of queryClient.getQueriesData<InfiniteData<ImageListDto>>({ queryKey: queryKeys.images.lists })) {
    const hit = data?.pages.flatMap((p) => p.items).find((i) => i.id === id);
    if (hit) return hit;
  }
  for (const [, data] of queryClient.getQueriesData<ConversationDetailDto>({ queryKey: queryKeys.conversations.details })) {
    const hit = data ? findImage(data, id) : null;
    if (hit) return hit;
  }
  return undefined;
}

// 딥링크로 열어 캐시가 없을 때. 이미지 자리(정사각)와 정보 패널 줄 모양으로 기다린다
function ViewerSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-6 p-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <span className="sr-only">불러오는 중…</span>
      <Skeleton aria-hidden="true" className="aspect-square w-full" />
      <div aria-hidden="true" className="flex flex-col gap-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-3/5" />
        <div className="mt-2 grid grid-cols-[3rem_7.5rem] gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-4" />
          ))}
        </div>
        <Skeleton className="mt-2 h-9 w-28" />
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  );
}

// 이미지 뷰어. 어느 화면에서든 ?image=<id> 가 있으면 열린다(딥링크). 닫으면 image 만 지우고 검색·필터는 남긴다
export function ImageViewerDialog() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const id = parseId(searchParams.get("image"));
  // 방금 휴지통으로 옮긴 id. 주소에서 image 가 빠지기 전까지 그 id 를 다시 불러 404 가 나지 않게 한다
  const [deletedId, setDeletedId] = useState<string | null>(null);
  // 타입 인자: placeholderData 가 함수라 queryFn 의 signal 인자와 함께 두면 추론이 placeholderData 쪽으로 붙는다
  const image = useQuery<ImageDto>({
    queryKey: queryKeys.images.detail(id ?? ""),
    // signal: 받는 중에 닫으면 요청을 끊는다
    queryFn: ({ signal }) => apiFetch<ImageDto>(`/api/images/${id}`, { signal }),
    enabled: id !== null && id !== deletedId,
    // 갤러리·대화에서 이미 받은 정보가 있으면 그것으로 바로 연다(새 정보는 받는 대로 바꾼다)
    placeholderData: () => (id ? findCachedImage(queryClient, id) : undefined),
    retry: (count, e) => !(e instanceof ApiClientError && e.status === 404) && count < 2,
  });

  function close() {
    const params = new URLSearchParams(searchParams);
    params.delete("image");
    const query = params.toString();
    // 주소만 바꾼다(Next 가 useSearchParams 와 맞추고 페이지를 서버에서 다시 그리지 않는다 — 여는 쪽 ViewerLink 와 같음)
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  }

  // 삭제 확인창(공용). 지우면 뷰어를 닫고, 지운 id 의 캐시는 주소가 바뀐 뒤 버린다
  const [deleting, setDeleting] = useState<ImageDto | null>(null);
  function handleDeleted(removedId: string) {
    setDeletedId(removedId);
    close();
    queryClient.removeQueries({ queryKey: queryKeys.images.detail(removedId) });
  }

  return (
    <Dialog open={id !== null} onOpenChange={(open) => !open && close()}>
      <ImageDeleteDialog image={deleting} onOpenChange={(open) => !open && setDeleting(null)} onDeleted={handleDeleted} />
      <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-5xl overflow-y-auto p-0 sm:max-w-5xl">
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <DialogTitle className="min-w-0 flex-1 truncate text-label">이미지 자세히 보기</DialogTitle>
          <DialogClose aria-label="닫기" className={ICON_BUTTON_CLASS}>
            <XIcon aria-hidden="true" className="size-4" />
          </DialogClose>
        </div>
        {image.isPending ? (
          <ViewerSkeleton />
        ) : image.isError ? (
          image.error instanceof ApiClientError && image.error.status === 404 ? (
            <p className="grid min-h-64 place-items-center px-4 text-caption text-muted-foreground">이미지를 찾을 수 없어요</p>
          ) : (
            <LoadError align="center" message="이미지를 불러오지 못했어요" onRetry={() => void image.refetch()} className="min-h-64" />
          )
        ) : (
          <div className="grid gap-6 p-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            {/* 큰 이미지를 받는 동안 이미 받아 둔 썸네일을 같은 자리에 깔아 둔다(thumb-under) */}
            <div
              className="thumb-under self-start rounded-md"
              style={{ "--thumb": `url(${JSON.stringify(image.data.thumbUrl)})` } as CSSProperties}
            >
              <FadeImage
                src={image.data.previewUrl}
                alt={promptAlt(image.data.prompt)}
                width={image.data.width}
                height={image.data.height}
                fetchPriority="high"
                className={cn("block h-auto max-h-[70dvh] w-full rounded-md object-contain", image.data.hasAlpha && "checker")}
              />
            </div>
            <ViewerPanel image={image.data} onDelete={() => setDeleting(image.data)} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
