"use client";

import { useEffect, useState } from "react";

import { StepMeter } from "@/components/chat/step-meter";
import { Button } from "@/components/ui/button";
import type { JobDto } from "@/lib/jobs/schemas";
import { isActive } from "@/lib/jobs/transitions";

// 대기 0건이거나 0 step 인 채로 이만큼 지나면 GPU 가 깨는 중이라고 알린다(배포 뒤 첫 요청은 GPU 기동·모델 적재로 2분쯤 걸린다)
const SLOW_START_MS = 15_000;
const SLOW_START_TEXT = "GPU를 깨우는 중이에요. 처음엔 2분쯤 걸려요";
// 취소·중지를 눌렀는데 잡이 이만큼 지나도 끝나지 않으면 버튼을 되돌린다
const CANCEL_RETRY_MS = 15_000;

// 결과가 아직 없는 잡 하나: 대기·진행(취소·중지), 실패·중지됨(다시 생성)
export function JobCard({ job, onCancel, onRegenerate }: { job: JobDto; onCancel: () => Promise<void>; onRegenerate: (() => void) | null }) {
  // 취소·중지를 눌렀는지(어느 버튼이었는지). 누르면 바로 "중지하는 중…"으로 바꾸고, 끝난 뒤 문구도 누른 버튼에 맞춘다
  const [cancelling, setCancelling] = useState<"취소" | "중지" | null>(null);
  const active = isActive(job.status);
  // 요청은 받았는데 잡이 계속 돌면(워커가 늦게 멈추거나 반영이 안 되면) 한참 뒤 버튼을 되돌려 다시 누를 수 있게 한다
  useEffect(() => {
    if (!cancelling || !active) return;
    const timer = setTimeout(() => setCancelling(null), CANCEL_RETRY_MS);
    return () => clearTimeout(timer);
  }, [cancelling, active]);
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
  // 취소·중지 요청. 실패하면(오류는 부른 쪽이 알린다) 버튼을 되돌린다
  const cancel = (label: "취소" | "중지") => {
    setCancelling(label);
    onCancel().catch(() => setCancelling(null));
  };
  switch (job.status) {
    case "QUEUED":
      title = "대기 중…";
      detail = job.queuePosition && job.queuePosition > 0 ? `앞에 ${job.queuePosition}건` : "곧 시작해요";
      action = { label: "취소", run: () => cancel("취소") };
      break;
    case "RUNNING":
      title = job.kind === "EDIT" ? "고치는 중…" : "생성 중…";
      // 마지막 step 뒤에는 결과를 받아 저장하는 중이다
      detail = job.step >= job.steps ? "마무리하는 중…" : steps;
      action = { label: "중지", run: () => cancel("중지") };
      break;
    case "FAILED":
      title = "실패했어요";
      action = onRegenerate && { label: "다시 생성", run: onRegenerate };
      break;
    default: {
      // 돌다가 중지한 잡과 시작 전에 취소한 잡을 구분한다(누른 버튼을 알면 그대로, 모르면 step 으로)
      const stopped = cancelling ? cancelling === "중지" : job.step > 0;
      title = stopped ? "중지했어요" : "취소했어요";
      detail = job.step > 0 ? steps : null;
      action = onRegenerate && { label: "다시 생성", run: onRegenerate };
    }
  }
  // 대기 0건·0 step 이 오래가면 위 문구 대신 GPU 를 깨우는 중이라고 알린다(starting 은 그 두 경우에만 참)
  if (starting && slow) detail = SLOW_START_TEXT;
  return (
    <div role="status" className="flex flex-col gap-3 rounded-md border bg-card p-4">
      {active && <StepMeter total={job.steps} step={job.step} variant="meter" />}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-label">{title}</span>
        {detail && <span className="text-caption text-muted-foreground tabular-nums">{detail}</span>}
        <span className="flex-1" />
        {action && (
          <Button type="button" variant="outline" size="sm" disabled={active && cancelling !== null} onClick={action.run} className="max-md:h-11">
            {active && cancelling ? (cancelling === "취소" ? "취소하는 중…" : "중지하는 중…") : action.label}
          </Button>
        )}
      </div>
      {job.status === "FAILED" && job.error && <p className="text-caption text-destructive">{job.error}</p>}
    </div>
  );
}
