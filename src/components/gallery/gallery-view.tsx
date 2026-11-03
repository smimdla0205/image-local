"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import { type GalleryFilter, GalleryFilters } from "@/components/gallery/gallery-filters";
import { GalleryGrid } from "@/components/gallery/gallery-grid";
import { ImageDeleteDialog } from "@/components/image-delete-dialog";
import { groupByDate } from "@/components/shell/day-groups";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/ui/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/api-client";
import { isModelId } from "@/lib/gpu/models";
import type { ImageDto, ImageListDto } from "@/lib/jobs/schemas";
import { queryKeys } from "@/lib/query-keys";

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="aspect-square" />
      ))}
    </div>
  );
}

// 갤러리: 만든·고친 이미지(최신순). 검색·모델 필터는 주소(?q·?model)에 둔다
export function GalleryView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").slice(0, 200);
  const rawModel = searchParams.get("model");
  const model = isModelId(rawModel) ? rawModel : "";

  const images = useInfiniteQuery({
    queryKey: queryKeys.images.list({ q: q || undefined, model: model || undefined }),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (model) params.set("model", model);
      if (pageParam) params.set("cursor", pageParam);
      return apiFetch<ImageListDto>(`/api/images?${params.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    // 검색·필터를 바꾸면 새 결과가 올 때까지 이전 결과를 흐리게 남긴다(자리표시로 깜빡이지 않게).
    // 이전 결과가 비어 있었으면 남기지 않는다(받기 전에 결과 없음을 보이지 않고 자리표시를 보인다)
    placeholderData: (previous) => (previous?.pages.some((p) => p.items.length > 0) ? previous : undefined),
  });

  // 필터를 주소에 반영한다(뷰어가 열려 있으면 그대로 둔다)
  const handleFilterChange = useCallback(
    (next: GalleryFilter) => {
      const params = new URLSearchParams(searchParams);
      if (next.q) params.set("q", next.q);
      else params.delete("q");
      if (next.model) params.set("model", next.model);
      else params.delete("model");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const items = images.data?.pages.flatMap((p) => p.items) ?? [];
  const filtered = q !== "" || model !== "";
  const [imageToDelete, setImageToDelete] = useState<ImageDto | null>(null);

  let content: React.ReactNode;
  if (images.isPending) content = <GridSkeleton />;
  // 받은 목록이 있으면(다음 페이지만 실패) 격자를 남기고 '더 보기' 옆에서 알린다
  else if (images.isError && !images.data) content = <LoadError align="center" message="목록을 불러오지 못했어요" onRetry={() => void images.refetch()} />;
  else if (items.length === 0) content = <p className="py-16 text-center text-caption text-muted-foreground">{filtered ? "찾는 이미지가 없어요" : "아직 만든 이미지가 없어요"}</p>;
  else
    content = (
      <div aria-busy={images.isPlaceholderData} className={cn("flex flex-col gap-6 motion-safe:transition-opacity", images.isPlaceholderData && "opacity-60")}>
        {groupByDate(items, new Date(), (img) => img.createdAt).map((group) => (
          <section key={group.label} className="flex flex-col gap-2">
            <h2 className="text-label">{group.label}</h2>
            <GalleryGrid images={group.items} label={`${group.label} 이미지`} onDelete={setImageToDelete} />
          </section>
        ))}
        {images.hasNextPage && (
          <div className="flex flex-col items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="max-md:h-11"
              disabled={images.isFetchingNextPage}
              aria-busy={images.isFetchingNextPage}
              onClick={() => void images.fetchNextPage()}
            >
              {images.isFetchingNextPage && <Spinner />}더 보기
            </Button>
            {images.isFetchNextPageError && <p className="text-caption text-muted-foreground">더 불러오지 못했어요. 다시 눌러 주세요</p>}
          </div>
        )}
      </div>
    );

  return (
    <>
      <Topbar title="갤러리" />
      <ImageDeleteDialog image={imageToDelete} onOpenChange={(open) => !open && setImageToDelete(null)} />
      <div className="flex w-full flex-1 flex-col gap-6 px-4 pt-2 pb-8 sm:px-6">
        <GalleryFilters q={q} model={model} onChange={handleFilterChange} />
        {content}
      </div>
    </>
  );
}

export function GallerySkeleton() {
  return (
    <div className="flex w-full flex-1 flex-col gap-6 px-4 pt-16 pb-8 sm:px-6">
      <Skeleton className="h-9 w-80 max-w-full" />
      <GridSkeleton />
    </div>
  );
}
