"use client";

import { ChevronDownIcon, RectangleHorizontalIcon } from "lucide-react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { type Ratio, RATIOS } from "@/lib/gpu/sizes";

const CHIP_CLASS =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border bg-card pr-2.5 pl-2 text-caption font-medium whitespace-nowrap transition-colors outline-none hover:bg-secondary focus-visible:shadow-focus-ring aria-expanded:bg-secondary max-md:h-11";

// 입력창 바의 비율 칩. 고칠 이미지가 있으면 쓰지 않는다(그때는 원본 비율)
export function RatioMenu({ value, onChange }: { value: Ratio; onChange: (r: Ratio) => void }) {
  return (
    <DropdownMenu>
      {/* 접근 가능한 이름에 보이는 글자(비율 값)를 포함한다(WCAG 2.5.3) */}
      <DropdownMenuTrigger className={CHIP_CLASS}>
        <RectangleHorizontalIcon aria-hidden="true" className="size-4" />
        <span className="sr-only">비율 </span>
        <span className="tabular-nums">{value}</span>
        <ChevronDownIcon aria-hidden="true" className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-32">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as Ratio)}>
          {RATIOS.map((r) => (
            <DropdownMenuRadioItem key={r} value={r} className="tabular-nums">
              {r}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
