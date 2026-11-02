import { cn } from "cn";

// step 수만큼 칸을 그린다. meter: 진행 막대(채운 칸만 signal 색), inline: 모델의 step 수 표시(진행 없음)
export function StepMeter({ total, step, variant }: { total: number; step: number; variant: "meter" | "inline" }) {
  const meter = variant === "meter";
  return (
    <span
      data-testid="step-meter"
      aria-hidden="true"
      className={meter ? "grid w-full gap-1" : "inline-flex h-3.5 items-center gap-0.5"}
      style={meter ? { gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` } : undefined}
    >
      {Array.from({ length: total }, (_, i) => (
        <i
          key={i}
          data-cell=""
          className={cn("block rounded-full", meter ? "h-1.5" : "h-3.5 w-[3px]", i < step ? "bg-signal" : meter ? "bg-secondary" : "bg-muted-foreground/60")}
        />
      ))}
    </span>
  );
}
