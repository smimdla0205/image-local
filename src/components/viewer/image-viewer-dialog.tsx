"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { XIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { ICON_BUTTON_CLASS } from "@/components/chat/composer-options";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { ViewerPanel } from "@/components/viewer/viewer-panel";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import type { ImageDto } from "@/lib/jobs/schemas";
import { queryKeys } from "@/lib/query-keys";

const ID_RE = /^[a-z0-9]+$/;

// 이미지 뷰어. 어느 화면에서든 ?image=<id> 가 있으면 열린다(딥링크). 닫으면 image 만 지우고 검색·필터는 남긴다
export function ImageViewerDialog() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const raw = searchParams.get("image");
  const id = raw && ID_RE.test(raw) ? raw : null;
  const image = useQuery({
    queryKey: queryKeys.images.detail(id ?? ""),
    queryFn: () => apiFetch<ImageDto>(`/api/images/${id}`),
    enabled: id !== null,
    retry: (count, e) => !(e instanceof ApiClientError && e.status === 404) && count < 2,
  });

  function close() {
    const params = new URLSearchParams(searchParams);
    params.delete("image");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  async function handleDelete() {
    if (!id) return;
    try {
      await apiFetch(`/api/images/${id}`, { method: "DELETE" });
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "이미지를 지우지 못했어요. 다시 시도해 주세요.");
      return;
    }
    close();
    // 지운 id 를 다시 불러 404 가 나지 않게 캐시에서 먼저 뺀다
    queryClient.removeQueries({ queryKey: queryKeys.images.detail(id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.images.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    toast.success("이미지를 삭제했어요");
  }

  const data = image.data;
  return (
    <Dialog open={id !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-5xl overflow-y-auto p-0 sm:max-w-5xl">
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <DialogTitle className="min-w-0 flex-1 truncate text-label">이미지 자세히 보기</DialogTitle>
          <DialogClose aria-label="닫기" className={ICON_BUTTON_CLASS}>
            <XIcon aria-hidden="true" className="size-4" />
          </DialogClose>
        </div>
        {image.isPending ? (
          <div className="grid min-h-64 place-items-center">
            <Spinner className="size-6" />
          </div>
        ) : image.isError || !data ? (
          <p className="grid min-h-64 place-items-center px-4 text-caption text-muted-foreground">
            {image.error instanceof ApiClientError && image.error.status === 404 ? "이미지를 찾을 수 없어요" : "이미지를 불러오지 못했어요"}
          </p>
        ) : (
          <div className="grid gap-6 p-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- 앱이 서빙하는 원본 PNG */}
            <img
              src={data.url}
              alt={data.prompt ?? "올린 사진"}
              width={data.width}
              height={data.height}
              className={cn("h-auto max-h-[70dvh] w-full rounded-md object-contain", data.hasAlpha && "checker")}
            />
            <ViewerPanel image={data} onDelete={handleDelete} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
