"use client";

import { cn } from "cn";
import { DownloadIcon, Maximize2Icon, PencilIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { FLOAT_CLASS } from "@/components/chat/styles";
import { FadeImage } from "@/components/fade-image";
import { ViewerLink } from "@/components/viewer/viewer-link";
import { getModel } from "@/lib/gpu/models";
import type { ImageDto } from "@/lib/jobs/schemas";

// 갤러리 타일 격자. 크게 보기는 지금 검색·필터를 남긴 채 ?image= 를 붙인다. 삭제는 공용 확인창을 연다
export function GalleryGrid({ images, label, onDelete }: { images: ImageDto[]; label: string; onDelete: (img: ImageDto) => void }) {
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
        const href = viewHref(img.id);
        return (
          <li key={img.id} className="image-frame group relative overflow-hidden rounded-md bg-muted">
            {/* 이미지를 눌러도 크게 본다(키보드는 '크게 보기' 버튼). 이미지를 링크 안에 두어 저장·복사 메뉴와 끌어 놓기는 그대로 된다 */}
            <ViewerLink href={href} tabIndex={-1} className="block cursor-zoom-in">
              <FadeImage src={img.thumbUrl} alt={img.prompt ?? ""} loading="lazy" className={cn("block aspect-square w-full object-cover", img.hasAlpha && "checker")} />
            </ViewerLink>
            <div className="hover-actions pointer-events-none absolute bottom-2 left-2 flex gap-1">
              {spec && <span className="rounded-sm bg-overlay px-1.5 py-0.5 text-micro text-overlay-foreground">{spec.shortName}</span>}
              <span className="rounded-sm bg-overlay px-1.5 py-0.5 text-micro text-overlay-foreground">{img.kind === "EDITED" ? "고침" : "생성"}</span>
            </div>
            <div className="hover-actions absolute top-2 right-2 flex gap-1">
              <ViewerLink href={href} aria-label="크게 보기" className={FLOAT_CLASS}>
                <Maximize2Icon aria-hidden="true" className="size-4" />
              </ViewerLink>
              {spec?.canEdit && img.conversationId && (
                <Link href={`/c/${img.conversationId}?target=${img.id}`} aria-label="이어서 고치기" className={FLOAT_CLASS}>
                  <PencilIcon aria-hidden="true" className="size-4" />
                </Link>
              )}
              <a href={img.url} download={`imagen-${img.id}.png`} aria-label="다운로드" className={FLOAT_CLASS}>
                <DownloadIcon aria-hidden="true" className="size-4" />
              </a>
              <button type="button" aria-label="삭제" onClick={() => onDelete(img)} className={FLOAT_CLASS}>
                <Trash2Icon aria-hidden="true" className="size-4" />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
