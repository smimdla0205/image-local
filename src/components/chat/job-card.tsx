"use client";

import { useEffect, useState } from "react";

import { StepMeter } from "@/components/chat/step-meter";
import { Button } from "@/components/ui/button";
import type { JobDto } from "@/lib/jobs/schemas";
import { isActive } from "@/lib/jobs/transitions";

// 대기 0건이거나 0 step 인 채로 이만큼 지나면 GPU 가 깨는 중이라고 알린다(배포 뒤 첫 요청은 GPU 기동·모델 적재로 2분쯤 걸린다)
const SLOW_START_MS = 15_000;
const SLOW_START_TEXT = "GPU를 깨우는 중이에요. 처음엔 2분쯤 걸려요";

// 결과가 아직 없는 잡 하나: 대기·진행(취소·중지), 실패·중지됨(다시 생성)
export function JobCard({ job, onCancel, onRegenerate }: { job: JobDto; onCancel: () => void; onRegenerate: (() => void) | null }) {
  // 워커가 맨 앞(앞에 0건)이라고 답한 대기에서 0 step 으로 넘어가도 같은 기다림이라 이어서 잰다(워커에 아직 못 보낸 잡은 순번이 없어 빠진다).
  // 잡은 이 상태로 돌아오지 않으므로 끝나면 다시 쓰지 않는다
  const starting = (job.status === "QUEUED" && job.queuePosition === 0) || (job.status === "RUNNING" && job.step === 0);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!starting) return;
    const timer = setTimeout(() => setSlow(true), SLOW_START_MS);
    return () => clearTimeout(timer);
  }, [starting]);

  const steps = `${job.step} / ${job.steps} step`;
  let title: string;
  let detail: string | null = null;
  let action: { label: string; run: () => void } | null = null;
  switch (job.status) {
    case "QUEUED":
      title = "대기 중…";
      detail = job.queuePosition && job.queuePosition > 0 ? `앞에 ${job.queuePosition}건` : "곧 시작해요";
      action = { label: "취소", run: onCancel };
      break;
    case "RUNNING":
      title = job.kind === "EDIT" ? "고치는 중…" : "생성 중…";
      // 마지막 step 뒤에는 결과를 받아 저장하는 중이다
      detail = job.step >= job.steps ? "마무리하는 중…" : steps;
      action = { label: "중지", run: onCancel };
      break;
    case "FAILED":
      title = "실패했어요";
      action = onRegenerate && { label: "다시 생성", run: onRegenerate };
      break;
    default:
      // 시작 전에 취소한 잡(0 step)과 돌다가 중지한 잡을 구분한다
      title = job.step > 0 ? "중지했어요" : "취소했어요";
      detail = job.step > 0 ? steps : null;
      action = onRegenerate && { label: "다시 생성", run: onRegenerate };
  }
  // 대기 0건·0 step 이 오래가면 위 문구 대신 GPU 를 깨우는 중이라고 알린다(starting 은 그 두 경우에만 참)
  if (starting && slow) detail = SLOW_START_TEXT;
  const active = isActive(job.status);
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
