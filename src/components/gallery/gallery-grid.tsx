"use client";

import { cn } from "cn";
import { DownloadIcon, Maximize2Icon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { FLOAT_CLASS } from "@/components/chat/result-card";
import { getModel } from "@/lib/gpu/models";
import type { ImageDto } from "@/lib/jobs/schemas";

// 갤러리 타일 격자. 크게 보기는 지금 검색·필터를 남긴 채 ?image= 를 붙인다
export function GalleryGrid({ images, label }: { images: ImageDto[]; label: string }) {
  const searchParams = useSearchParams();
  const viewHref = (id: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("image", id);
    return `?${params.toString()}`;
  };
  return (
    <ul aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {images.map((img) => {
        const spec = img.model ? getModel(img.model) : null;
        return (
          <li key={img.id} className="group relative overflow-hidden rounded-md bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element -- 앱이 서빙하는 512px WebP 썸네일 */}
            <img src={img.thumbUrl} alt={img.prompt ?? ""} loading="lazy" className={cn("block aspect-square w-full object-cover", img.hasAlpha && "checker")} />
            {/* 이미지 어디를 눌러도 크게 본다. 키보드·스크린리더는 '크게 보기' 버튼을 쓴다 */}
            <Link href={viewHref(img.id)} scroll={false} tabIndex={-1} aria-hidden="true" className="absolute inset-0 cursor-zoom-in" />
            <div className="hover-actions pointer-events-none absolute bottom-2 left-2 flex gap-1">
              {spec && <span className="rounded-sm bg-overlay px-1.5 py-0.5 text-micro text-overlay-foreground">{spec.shortName}</span>}
              <span className="rounded-sm bg-overlay px-1.5 py-0.5 text-micro text-overlay-foreground">{img.kind === "EDITED" ? "고침" : "생성"}</span>
            </div>
            <div className="hover-actions absolute top-2 right-2 flex gap-1">
              <Link href={viewHref(img.id)} scroll={false} aria-label="크게 보기" className={FLOAT_CLASS}>
                <Maximize2Icon aria-hidden="true" className="size-4" />
              </Link>
              {spec?.canEdit && img.conversationId && (
                <Link href={`/c/${img.conversationId}?target=${img.id}`} aria-label="이어서 고치기" className={FLOAT_CLASS}>
                  <PencilIcon aria-hidden="true" className="size-4" />
                </Link>
              )}
              <a href={img.url} download={`imagen-${img.id}.png`} aria-label="다운로드" className={FLOAT_CLASS}>
                <DownloadIcon aria-hidden="true" className="size-4" />
              </a>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
