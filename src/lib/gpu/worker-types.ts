// GPU 워커 HTTP API 응답 스키마(계약은 gpu/worker/schemas.py). 워커 응답은 외부 입력이라 zod 로 확인한다
// 단위 테스트가 별칭 없이 불러오므로 이 파일은 상대 경로 import 만 쓴다
import { z } from "zod";

import type { ModelId } from "./models";

export const workerJobStatusValues = ["queued", "running", "succeeded", "failed", "cancelled"] as const;

export const workerHealthSchema = z.object({ ok: z.literal(true), backend: z.enum(["modal", "mock"]), models: z.array(z.string()) });

export const workerInputSchema = z.object({ input_id: z.string(), width: z.number().int(), height: z.number().int() });

export const workerJobStatusSchema = z.object({
  id: z.string(),
  status: z.enum(workerJobStatusValues),
  step: z.number().int().default(0),
  total: z.number().int(),
  queue_position: z.number().int().default(0),
  error: z.string().nullable().default(null),
  output: z
    .object({ width: z.number().int(), height: z.number().int(), content_type: z.literal("image/png"), has_alpha: z.boolean() })
    .nullable()
    .default(null),
});

// POST /jobs 의 202(새로 만듦)와 200(같은 id 재전송) 둘 다 이 모양으로 읽는다(200 본문의 나머지 키는 버린다)
export const workerJobAcceptedSchema = z.object({ id: z.string(), status: z.enum(workerJobStatusValues), queue_position: z.number().int().default(0) });

export const workerCancelSchema = z.object({ id: z.string(), status: z.enum(["cancelled", "cancel_requested"]) });

export const workerErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

export type WorkerHealth = z.infer<typeof workerHealthSchema>;
export type WorkerInput = z.infer<typeof workerInputSchema>;
export type WorkerJobStatus = z.infer<typeof workerJobStatusSchema>;
export type WorkerJobAccepted = z.infer<typeof workerJobAcceptedSchema>;
export type WorkerCancel = z.infer<typeof workerCancelSchema>;

export type WorkerJobRequest = {
  id: string;
  model: ModelId;
  kind: "generate" | "edit";
  prompt: string;
  width: number;
  height: number;
  seed: number;
  steps: number;
  transparent: boolean;
  input_id: string | null;
};
