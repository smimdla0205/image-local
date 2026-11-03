"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { ImagesIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";

import { type GalleryFilter, GalleryFilters } from "@/components/gallery/gallery-filters";
import { GalleryGrid } from "@/components/gallery/gallery-grid";
import { ImageDeleteDialog } from "@/components/image-delete-dialog";
import { groupByDate } from "@/components/shell/day-groups";
import { Topbar } from "@/components/shell/topbar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { LoadError } from "@/components/ui/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import { isModelId } from "@/lib/gpu/models";
import type { ImageDto, ImageListDto } from "@/lib/jobs/schemas";
import { replaceSearch, useLocationSearch } from "@/lib/location-search";
import { queryKeys } from "@/lib/query-keys";

// 격자 자리. announce: 한 번 낭독할지(더 보기 때는 버튼이 '불러오는 중…' 을 말하므로 끈다)
function GridSkeleton({ announce = true }: { announce?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" aria-busy={announce ? "true" : undefined}>
      {announce && <span className="sr-only">불러오는 중…</span>}
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} aria-hidden="true" className="aspect-square" />
      ))}
    </div>
  );
}

// 주소의 검색·모델 필터(없거나 모르는 값이면 빈 값)
function readFilter(params: { get(name: string): string | null }): GalleryFilter {
  const rawModel = params.get("model");
  return { q: (params.get("q") ?? "").slice(0, 200), model: isModelId(rawModel) ? rawModel : "" };
}

// 갤러리: 만든·고친 이미지(최신순). 검색·모델 필터는 주소(?q·?model)에 둔다.
// 필터는 주소를 브라우저 location 으로 읽어(서버에서는 빈 값) 정적 셸에 들어가고, 목록만 Suspense 안에서 useSearchParams 를 쓴다
export function GalleryView() {
  const filter = readFilter(new URLSearchParams(useLocationSearch()));
  const [imageToDelete, setImageToDelete] = useState<ImageDto | null>(null);

  // 필터를 주소에 반영한다(뷰어의 ?image= 같은 다른 값은 그대로 둔다)
  const handleFilterChange = useCallback((next: GalleryFilter) => {
    const params = new URLSearchParams(window.location.search);
    if (next.q) params.set("q", next.q);
    else params.delete("q");
    if (next.model) params.set("model", next.model);
    else params.delete("model");
    replaceSearch(params.toString());
  }, []);

  return (
    <>
      <Topbar title="갤러리" />
      <ImageDeleteDialog image={imageToDelete} onOpenChange={(open) => !open && setImageToDelete(null)} />
      <div className="flex w-full flex-1 flex-col gap-6 px-4 pt-2 pb-8 sm:px-6">
        <GalleryFilters q={filter.q} model={filter.model} onChange={handleFilterChange} />
        <Suspense fallback={<GridSkeleton />}>
          <GalleryList onDelete={setImageToDelete} />
        </Suspense>
      </div>
    </>
  );
}

// 목록(날짜 묶음 격자·더 보기·빈 상태). 주소의 필터로 받는다
function GalleryList({ onDelete }: { onDelete: (img: ImageDto) => void }) {
  const { q, model } = readFilter(useSearchParams());

  const images = useInfiniteQuery({
    queryKey: queryKeys.images.list({ q: q || undefined, model: model || undefined }),
    // signal: 검색·필터가 바뀌어 이 목록을 보는 쪽이 없어지면 받던 요청을 끊는다(썸네일이 쓸 연결을 돌려준다).
    // 키가 바뀌지 않는 사이드바·뷰어 요청에는 쓰지 않는다 — 개발 모드 StrictMode 의 두 번 구독으로 첫 요청이 끊기고 다시 가기만 한다
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (model) params.set("model", model);
      if (pageParam) params.set("cursor", pageParam);
      return apiFetch<ImageListDto>(`/api/images?${params.toString()}`, { signal });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    // 창 포커스마다 받은 페이지를 전부 다시 받지 않는다(삭제·생성 같은 동작이 무효화한다)
    refetchOnWindowFocus: false,
    // 검색·필터를 바꾸면 새 결과가 올 때까지 이전 결과를 흐리게 남긴다(자리표시로 깜빡이지 않게).
    // 이전 결과가 비어 있었으면 남기지 않는다(받기 전에 결과 없음을 보이지 않고 자리표시를 보인다)
    placeholderData: (previous) => (previous?.pages.some((p) => p.items.length > 0) ? previous : undefined),
  });

  const items = images.data?.pages.flatMap((p) => p.items) ?? [];
  const filtered = q !== "" || model !== "";

  if (images.isPending) return <GridSkeleton />;
  // 받은 목록이 있으면(다음 페이지만 실패) 격자를 남기고 '더 보기' 옆에서 알린다
  if (images.isError && !images.data) return <LoadError align="center" message="목록을 불러오지 못했어요" onRetry={() => void images.refetch()} />;
  if (items.length === 0)
    return (
      <Empty className="border py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ImagesIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{filtered ? "찾는 이미지가 없어요" : "아직 만든 이미지가 없어요"}</EmptyTitle>
          <EmptyDescription>{filtered ? "검색어나 모델 필터를 바꿔 보세요" : "새 대화에서 첫 이미지를 만들어 보세요"}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {filtered ? (
            <Button type="button" variant="outline" onClick={() => replaceSearch("")} className="max-md:h-11">
              필터 지우기
            </Button>
          ) : (
            <Link href="/" className={buttonVariants({ variant: "default" })}>
              새 대화
            </Link>
          )}
        </EmptyContent>
      </Empty>
    );
  return (
    <div aria-busy={images.isPlaceholderData} className={cn("flex flex-col gap-6 motion-safe:transition-opacity", images.isPlaceholderData && "opacity-60")}>
      {groupByDate(items, new Date(), (img) => img.createdAt).map((group, i, groups) => (
        <section key={group.label} className="flex flex-col gap-2">
          <h2 className="text-label">{group.label}</h2>
          <GalleryGrid
            images={group.items}
            label={`${group.label} 이미지`}
            startIndex={groups.slice(0, i).reduce((n, g) => n + g.items.length, 0)}
            onDelete={onDelete}
          />
        </section>
      ))}
      {images.isFetchingNextPage && <GridSkeleton announce={false} />}
      {images.hasNextPage && (
        <div className="flex flex-col items-center gap-2">
          <Button type="button" variant="outline" className="max-md:h-11" disabled={images.isFetchingNextPage} onClick={() => void images.fetchNextPage()}>
            {images.isFetchingNextPage ? "불러오는 중…" : "더 보기"}
          </Button>
          {images.isFetchNextPageError && <p className="text-caption text-muted-foreground">더 불러오지 못했어요. 다시 눌러 주세요</p>}
        </div>
      )}
    </div>
  );
}
