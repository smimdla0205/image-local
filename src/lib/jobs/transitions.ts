// 워커 상태 → 앱 잡 상태 전이(순수 함수). 단위 테스트가 불러오므로 상대 경로 import 만 쓴다
import type { WorkerJobStatus } from "../gpu/worker-types";
import type { JobStatusValue } from "./schemas";

export type { JobStatusValue };

export const WORKER_STATUS_MAP = {
  queued: "QUEUED",
  running: "RUNNING",
  succeeded: "SUCCEEDED",
  failed: "FAILED",
  cancelled: "CANCELLED",
} as const satisfies Record<WorkerJobStatus["status"], JobStatusValue>;

export const WORKER_LOST_MESSAGE = "워커가 작업을 잃어버렸어요. 다시 생성해 주세요.";
const UNKNOWN_FAILURE_MESSAGE = "알 수 없는 오류예요.";

export type SyncableJob = { status: JobStatusValue; step: number; hasImage: boolean };
export type JobPatch = { status?: JobStatusValue; step?: number; queuePosition?: number | null; error?: string | null };

// 아직 끝나지 않은 상태(Prisma `in` 조건에 그대로 넘기도록 변경 가능한 배열)
export const ACTIVE_STATUSES: JobStatusValue[] = ["QUEUED", "RUNNING"];

export function isActive(status: JobStatusValue): boolean {
  return ACTIVE_STATUSES.includes(status);
}

// 이미 끝난 잡은 바꾸지 않는다. succeeded 는 결과 이미지가 아직 없을 때만 내려받게 한다(이미지와 함께 저장)
export function applyWorkerStatus(job: SyncableJob, ws: WorkerJobStatus): { patch: JobPatch; fetchOutput: boolean } {
  if (!isActive(job.status)) return { patch: {}, fetchOutput: false };
  switch (ws.status) {
    case "queued":
      return { patch: { status: "QUEUED", step: ws.step, queuePosition: ws.queue_position }, fetchOutput: false };
    case "running":
      return { patch: { status: "RUNNING", step: ws.step, queuePosition: 0 }, fetchOutput: false };
    case "succeeded":
      return { patch: { status: "SUCCEEDED", step: ws.total, queuePosition: null, error: null }, fetchOutput: !job.hasImage };
    case "failed":
      return { patch: { status: "FAILED", error: ws.error ?? UNKNOWN_FAILURE_MESSAGE }, fetchOutput: false };
    case "cancelled":
      return { patch: { status: "CANCELLED", queuePosition: null }, fetchOutput: false };
  }
}
