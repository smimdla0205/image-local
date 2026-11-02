"use client";

import { cn } from "cn";
import { CheckIcon } from "lucide-react";
import { useId } from "react";

import { StepMeter } from "@/components/chat/step-meter";
import { Badge } from "@/components/ui/badge";
import { type ModelId, MODELS } from "@/lib/gpu/models";

// 새 대화의 모델 카드. 네이티브 라디오라 키보드(화살표)·스크린리더가 기본으로 동작한다
export function ModelPicker({ value, onChange, disabledIds = [] }: { value: ModelId; onChange: (m: ModelId) => void; disabledIds?: ModelId[] }) {
  const legendId = useId();
  return (
    <fieldset role="radiogroup" aria-labelledby={legendId} className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend id={legendId} className="mb-2 p-0 text-label">
        이 대화의 모델
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {MODELS.map((m) => {
          const disabled = disabledIds.includes(m.id);
          return (
            <label
              key={m.id}
              className={cn(
                "relative flex cursor-pointer flex-col gap-1.5 rounded-md border bg-card px-4 py-3 transition-colors hover:bg-muted",
                "has-checked:border-signal has-checked:bg-signal-subtle has-checked:shadow-[inset_0_0_0_1px_var(--signal)] has-focus-visible:shadow-focus-ring",
                disabled && "cursor-not-allowed opacity-50 hover:bg-card",
              )}
            >
              {/* 투명한 라디오를 카드 전체에 펼쳐 카드 어디를 눌러도 라디오가 직접 클릭을 받는다 */}
              <input
                type="radio"
                name="model"
                value={m.id}
                checked={value === m.id}
                disabled={disabled}
                onChange={() => onChange(m.id)}
                className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none rounded-md opacity-0 disabled:cursor-not-allowed"
              />
              <span className="pr-6 text-label font-semibold">{m.name}</span>
              <span className="text-caption text-muted-foreground">{m.description}</span>
              <span className="flex flex-wrap items-center gap-1.5 text-micro text-muted-foreground">
                <StepMeter total={m.steps} step={0} variant="inline" />
                <span className="tabular-nums">{m.steps} step</span>
                {m.badges.map((b) => (
                  <Badge key={b} variant="outline">
                    {b}
                  </Badge>
                ))}
              </span>
              <CheckIcon aria-hidden="true" className="absolute top-3 right-3 size-4 text-transparent peer-checked:text-signal" />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
