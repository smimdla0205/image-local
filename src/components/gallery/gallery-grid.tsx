"use client";

import { cn } from "cn";
import { DownloadIcon, Maximize2Icon, PencilIcon, Trash2Icon, WandSparklesIcon } from "lucide-react";
import Link from "next/link";
import { memo } from "react";

import { FLOAT_CLASS } from "@/components/chat/styles";
import { FadeImage } from "@/components/fade-image";
import { ViewerLink } from "@/components/viewer/viewer-link";
import { getModel } from "@/lib/gpu/models";
import { promptAlt } from "@/lib/jobs/constants";
import type { ImageDto } from "@/lib/jobs/schemas";

// 첫 화면에 보이는 타일 수(먼저 받는다). 그중 앞 4장은 높은 우선순위
const EAGER_COUNT = 8;
const HIGH_PRIORITY_COUNT = 4;

// 타일 하나. 이미지·순번·삭제 핸들러가 같으면 다시 그리지 않는다(검색어를 바꾸거나 삭제창을 열어도 격자가 그대로다).
// 화면 밖 타일은 그리지 않는다(.gallery-tile 의 content-visibility)
const GalleryTile = memo(function GalleryTile({ img, order, onDelete }: { img: ImageDto; order: number; onDelete: (img: ImageDto) => void }) {
  const spec = img.model ? getModel(img.model) : null;
  return (
    <li className="gallery-tile image-frame group relative overflow-hidden rounded-md bg-muted">
      {/* 이미지를 눌러도 크게 본다(키보드는 '크게 보기' 버튼). 이미지를 링크 안에 두어 저장·복사 메뉴와 끌어 놓기는 그대로 된다 */}
      <ViewerLink imageId={img.id} tabIndex={-1} className="block cursor-zoom-in">
        <FadeImage
          src={img.thumbUrl}
          alt={promptAlt(img.prompt)}
          loading={order < EAGER_COUNT ? "eager" : "lazy"}
          fetchPriority={order < HIGH_PRIORITY_COUNT ? "high" : undefined}
          className={cn("block aspect-square w-full object-cover", img.hasAlpha && "checker")}
        />
      </ViewerLink>
      {/* 모델·방식 배지는 올렸을 때만 보이는 보조 표시라 낭독에서 뺀다(방식 이름이 '이어서 고치기' 버튼 이름과 겹친다) */}
      <div aria-hidden="true" className="hover-actions pointer-events-none absolute bottom-2 left-2 flex gap-1">
        {spec && <span className="rounded-sm bg-overlay px-1.5 py-0.5 text-micro text-overlay-foreground">{spec.shortName}</span>}
        <span className="rounded-sm bg-overlay px-1.5 py-0.5 text-micro text-overlay-foreground">{img.kind === "EDITED" ? "이어서 고치기" : "텍스트→이미지"}</span>
      </div>
      <div className="hover-actions absolute top-2 right-2 flex gap-1">
        <ViewerLink imageId={img.id} aria-label="크게 보기" className={FLOAT_CLASS}>
          <Maximize2Icon aria-hidden="true" className="size-4" />
        </ViewerLink>
        {/* 고칠 수 있는 모델은 그 대화에서 이어서, 못 하는 모델(MOSS)은 새 대화에서 다른 모델로(대화 결과 타일과 같다) */}
        {spec?.canEdit && img.conversationId && (
          <Link href={`/c/${img.conversationId}?target=${img.id}`} aria-label="이어서 고치기" className={FLOAT_CLASS}>
            <PencilIcon aria-hidden="true" className="size-4" />
          </Link>
        )}
        {spec && !spec.canEdit && (
          <Link href={`/?edit=${img.id}`} aria-label="다른 모델로 고치기" className={FLOAT_CLASS}>
            <WandSparklesIcon aria-hidden="true" className="size-4" />
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
});

// 갤러리 타일 격자. 크게 보기는 지금 검색·필터를 남긴 채 ?image= 를 붙인다. 삭제는 공용 확인창을 연다.
// startIndex: 날짜 묶음이 여럿이라 전체 목록에서 이 격자가 시작하는 순번(이미지 우선순위 계산)
export function GalleryGrid({ images, label, startIndex = 0, onDelete }: { images: ImageDto[]; label: string; startIndex?: number; onDelete: (img: ImageDto) => void }) {
  return (
    <ul aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {images.map((img, i) => (
        <GalleryTile key={img.id} img={img} order={startIndex + i} onDelete={onDelete} />
      ))}
    </ul>
  );
}
