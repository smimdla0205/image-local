"use client";

import { cn } from "cn";
import { ImageOffIcon } from "lucide-react";
import Link from "next/link";

// 결과 격자(tile)는 지운 이미지(잡)의 원래 비율로 자리를 지킨다. 말풍선(ref)은 입력 썸네일 자리(정사각)
type Props = { size: "tile"; width: number; height: number } | { size: "ref" };

// 휴지통으로 옮긴 이미지의 자리표시자. 틀은 그대로 두고 복구 링크를 준다
export function DeletedImage(props: Props) {
  const tile = props.size === "tile";
  return (
    <div
      data-testid="deleted-image"
      style={props.size === "tile" ? { aspectRatio: `${props.width} / ${props.height}` } : undefined}
      className={cn(
        "grid place-content-center justify-items-center gap-1 rounded-md bg-muted text-muted-foreground outline-1 outline-dashed outline-border",
        tile ? "w-full -outline-offset-6" : "size-24 -outline-offset-4",
      )}
    >
      <span role="img" aria-label="삭제한 이미지예요" className="grid justify-items-center gap-1">
        <ImageOffIcon aria-hidden="true" className={tile ? "size-5" : "size-4"} />
        <span className={tile ? "text-micro" : "sr-only"}>삭제한 이미지예요</span>
      </span>
      {tile && (
        <Link href="/trash" className="rounded-sm text-label text-foreground underline underline-offset-4 outline-none focus-visible:shadow-focus-ring">
          복구
        </Link>
      )}
    </div>
  );
}
