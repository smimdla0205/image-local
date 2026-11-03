"use client";

import { ChevronsLeftRightIcon } from "lucide-react";
import { useId, useState } from "react";

import { FadeImage } from "@/components/fade-image";
import type { ImageDto } from "@/lib/jobs/schemas";

// 고치기 전(왼쪽)과 후(오른쪽)를 겹쳐 놓고 경계선을 움직여 비교한다. 투명한 range 입력이 위를 덮어 키보드(화살표)로도 움직인다.
// 입력이 투명하므로 키보드 포커스는 바깥 틀의 포커스 링으로 보여 준다. 두 장은 다 받은 뒤 함께 보인다(image-frame)
export function CompareSlider({ before, after }: { before: ImageDto; after: ImageDto }) {
  const [pos, setPos] = useState(50);
  const id = useId();
  return (
    <div
      data-testid="compare-slider"
      className="image-frame relative w-full overflow-hidden rounded-md bg-muted has-focus-visible:shadow-focus-ring"
      style={{ aspectRatio: `${after.width} / ${after.height}` }}
    >
      <FadeImage src={after.previewUrl} alt={`버전 ${after.version}: ${after.prompt ?? ""}`} loading="lazy" className="absolute inset-0 size-full object-cover" />
      <FadeImage
        src={before.previewUrl}
        alt={`버전 ${before.version}`}
        loading="lazy"
        className="absolute inset-0 size-full object-cover"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white/90 shadow" style={{ left: `${pos}%` }} />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-black shadow"
        style={{ left: `${pos}%` }}
      >
        <ChevronsLeftRightIcon className="size-4" />
      </span>
      <span aria-hidden="true" className="pointer-events-none absolute top-2 left-2 rounded-sm bg-overlay px-2 py-0.5 text-micro text-overlay-foreground">
        버전 {before.version}
      </span>
      <span aria-hidden="true" className="pointer-events-none absolute top-2 right-2 rounded-sm bg-overlay px-2 py-0.5 text-micro text-overlay-foreground">
        버전 {after.version}
      </span>
      <label htmlFor={id} className="sr-only">
        버전 {before.version} 과 버전 {after.version} 비교 위치
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        className="absolute inset-0 m-0 size-full cursor-ew-resize appearance-none bg-transparent opacity-0 focus-visible:opacity-0"
      />
    </div>
  );
}
