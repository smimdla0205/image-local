"use client";

import { cn } from "cn";
import { SlidersHorizontalIcon } from "lucide-react";
import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";

export const COUNTS = [1, 2, 4] as const;
export type Count = (typeof COUNTS)[number];

export const ICON_BUTTON_CLASS =
  "inline-grid size-8 shrink-0 place-items-center rounded-md text-foreground transition-colors outline-none hover:bg-secondary focus-visible:shadow-focus-ring disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent aria-expanded:bg-secondary max-md:size-11";

type Props = {
  count: Count;
  onCountChange: (c: Count) => void;
  // 투명 배경을 지원하는 모델일 때만 스위치를 보인다
  transparent: boolean | null;
  onTransparentChange: (v: boolean) => void;
  seed: string;
  seedInvalid: boolean;
  onSeedChange: (v: string) => void;
};

// 생성 옵션 팝오버: 장수·투명 배경·시드(비율은 입력창 바의 칩)
export function ComposerOptions({ count, onCountChange, transparent, onTransparentChange, seed, seedInvalid, onSeedChange }: Props) {
  const countId = useId();
  const transparentId = useId();
  const seedId = useId();
  return (
    <Popover>
      <PopoverTrigger aria-label="생성 옵션" className={ICON_BUTTON_CLASS}>
        <SlidersHorizontalIcon aria-hidden="true" className="size-[18px]" />
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-72 flex-col gap-4 p-4">
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" aria-describedby={`${countId}-hint`}>
          <legend className="mb-2 p-0 text-label">장수</legend>
          <div className="flex gap-1.5">
            {COUNTS.map((c) => (
              <label
                key={c}
                className="relative flex h-8 flex-1 cursor-pointer items-center justify-center rounded-md border text-caption font-medium has-checked:border-signal has-checked:bg-signal-subtle has-focus-visible:shadow-focus-ring max-md:h-11"
              >
                <input
                  type="radio"
                  name={countId}
                  value={c}
                  checked={count === c}
                  onChange={() => onCountChange(c)}
                  className="absolute inset-0 m-0 size-full cursor-pointer appearance-none rounded-md opacity-0"
                />
                {c}장
              </label>
            ))}
          </div>
          <p id={`${countId}-hint`} className="text-caption text-muted-foreground">
            GPU 1대에서 한 장씩 차례로 만들어요.
          </p>
        </fieldset>
        {transparent !== null && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-3">
              <span id={transparentId} className="text-label">
                투명 배경
              </span>
              <Switch aria-labelledby={transparentId} aria-describedby={`${transparentId}-hint`} checked={transparent} onCheckedChange={(v) => onTransparentChange(v)} />
            </div>
            <p id={`${transparentId}-hint`} className="text-caption text-muted-foreground">
              배경 없이 RGBA 이미지로 만들어요.
            </p>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={seedId} className="text-label">
            시드
          </label>
          <Input
            id={seedId}
            inputMode="numeric"
            autoComplete="off"
            placeholder="비우면 무작위"
            value={seed}
            aria-invalid={seedInvalid}
            aria-describedby={seedInvalid ? `${seedId}-error` : undefined}
            onChange={(e) => onSeedChange(e.target.value)}
            className={cn("tabular-nums", seedInvalid && "border-destructive")}
          />
          {seedInvalid && (
            <p id={`${seedId}-error`} className="text-caption text-destructive">
              0 이상 2147483647 이하의 정수를 입력해 주세요.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
