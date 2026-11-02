"use client";

import { StepMeter } from "@/components/chat/step-meter";
import { Button } from "@/components/ui/button";
import type { JobDto } from "@/lib/jobs/schemas";

// 결과가 아직 없는 잡 하나: 대기·진행(취소·중지), 실패·중지됨(다시 생성)
export function JobCard({ job, onCancel, onRegenerate }: { job: JobDto; onCancel: () => void; onRegenerate: (() => void) | null }) {
  const steps = `${job.step} / ${job.steps} step`;
  let title: string;
  let detail: string | null = null;
  let action: { label: string; run: () => void } | null = null;
  switch (job.status) {
    case "QUEUED":
      title = "대기 중";
      detail = job.queuePosition && job.queuePosition > 0 ? `앞에 ${job.queuePosition}건` : "곧 시작해요";
      action = { label: "취소", run: onCancel };
      break;
    case "RUNNING":
      title = job.kind === "EDIT" ? "고치는 중" : "생성 중";
      detail = steps;
      action = { label: "중지", run: onCancel };
      break;
    case "FAILED":
      title = "실패했어요";
      action = onRegenerate && { label: "다시 생성", run: onRegenerate };
      break;
    default:
      title = "중지했어요";
      detail = steps;
      action = onRegenerate && { label: "다시 생성", run: onRegenerate };
  }
  const active = job.status === "QUEUED" || job.status === "RUNNING";
  return (
    <div role="status" className="flex flex-col gap-3 rounded-md border bg-card p-4">
      {active && <StepMeter total={job.steps} step={job.step} variant="meter" />}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-label">{title}</span>
        {detail && <span className="text-caption text-muted-foreground tabular-nums">{detail}</span>}
        <span className="flex-1" />
        {action && (
          <Button type="button" variant="outline" size="sm" onClick={action.run} className="max-md:h-11">
            {action.label}
          </Button>
        )}
      </div>
      {job.status === "FAILED" && job.error && <p className="text-caption text-destructive">{job.error}</p>}
    </div>
  );
}
