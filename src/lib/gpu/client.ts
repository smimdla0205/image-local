// GPU 워커 HTTP 클라이언트(서버 전용). 모든 요청에 Bearer 토큰과 타임아웃을 붙이고, GET 만 한 번 다시 시도한다
// 단위 테스트가 별칭 없이 불러오므로 이 파일은 상대 경로 import 만 쓴다
import type { z } from "zod";

import { readStreamLimited } from "../streams";
import {
  type WorkerCancel,
  workerCancelSchema,
  workerErrorSchema,
  type WorkerHealth,
  workerHealthSchema,
  type WorkerInput,
  workerInputSchema,
  type WorkerJobAccepted,
  workerJobAcceptedSchema,
  type WorkerJobRequest,
  type WorkerJobStatus,
  workerJobStatusSchema,
} from "./worker-types";

export const WORKER_TIMEOUTS = { get: 5_000, create: 15_000, download: 60_000 } as const;
const RETRY_DELAY_MS = 200;
// 결과 PNG 상한(2048×2048 RGBA 무압축도 16MB 라 넉넉하다). 넘으면 워커 응답이 이상한 것으로 본다
export const WORKER_OUTPUT_MAX_BYTES = 64 * 1024 * 1024;

export type WorkerErrorKind = "unreachable" | "timeout" | "http" | "invalid_response";

// 메시지는 고정 영문이다(토큰·프롬프트를 담지 않는다). 사용자에게 보일 수 있는 워커 문구는 workerMessage 에 따로 둔다
export class WorkerError extends Error {
  readonly kind: WorkerErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly workerMessage?: string;

  constructor(kind: WorkerErrorKind, status?: number, code?: string, workerMessage?: string) {
    super(kind === "http" ? `worker http ${status}` : `worker ${kind}`);
    this.name = "WorkerError";
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.workerMessage = workerMessage;
  }
}

// 워커를 지금 쓸 수 없는 오류(잡 자체의 실패가 아님): 연결 실패·타임아웃·이상한 응답, 인증·과부하·5xx
export function isWorkerUnavailable(e: unknown): boolean {
  if (!(e instanceof WorkerError)) return false;
  if (e.kind !== "http") return true;
  const status = e.status ?? 0;
  return status === 401 || status === 403 || status === 408 || status === 429 || status >= 500;
}

export type WorkerClient = {
  health(): Promise<WorkerHealth>;
  createInput(bytes: Uint8Array, contentType: "image/png" | "image/jpeg" | "image/webp"): Promise<WorkerInput>;
  createJob(req: WorkerJobRequest): Promise<WorkerJobAccepted>;
  getJob(id: string): Promise<WorkerJobStatus>;
  getOutput(id: string): Promise<Uint8Array>;
  cancelJob(id: string): Promise<WorkerCancel>;
};

type SendOptions = { method: "GET" | "POST" | "DELETE"; timeout: number; body?: BodyInit; contentType?: string };

function isAbortError(e: unknown): boolean {
  return e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
}

async function httpError(res: Response): Promise<WorkerError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // 오류 본문이 JSON 이 아니면(프록시의 HTML 등) 상태 코드만 남긴다
  }
  const parsed = workerErrorSchema.safeParse(body);
  return parsed.success ? new WorkerError("http", res.status, parsed.data.error.code, parsed.data.error.message) : new WorkerError("http", res.status);
}

// 본문을 상한까지만 읽는다. 넘으면 이상한 응답, 읽는 도중 끊기거나 시간이 다 되면 워커 사용 불가 오류로 바꾼다
async function readLimited(res: Response, maxBytes: number): Promise<Uint8Array> {
  let bytes: Uint8Array | null;
  try {
    bytes = await readStreamLimited(res.body, maxBytes);
  } catch (e) {
    throw new WorkerError(isAbortError(e) ? "timeout" : "unreachable");
  }
  if (!bytes) throw new WorkerError("invalid_response");
  return bytes;
}

async function readJson<T>(res: Response, schema: z.ZodType<T>): Promise<T> {
  if (!res.ok) throw await httpError(res);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new WorkerError("invalid_response");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new WorkerError("invalid_response");
  return parsed.data;
}

export function createWorkerClient(opts: { baseUrl: string; token: string; fetchImpl?: typeof fetch }): WorkerClient {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const fetchImpl = opts.fetchImpl ?? fetch;

  async function send(path: string, o: SendOptions): Promise<Response> {
    const attempts = o.method === "GET" ? 2 : 1;
    for (let attempt = 1; ; attempt++) {
      const headers = new Headers({ Authorization: `Bearer ${opts.token}` });
      if (o.contentType) headers.set("Content-Type", o.contentType);
      try {
        return await fetchImpl(`${base}${path}`, { method: o.method, headers, body: o.body, signal: AbortSignal.timeout(o.timeout) });
      } catch (e) {
        const kind = isAbortError(e) ? "timeout" : "unreachable";
        if (attempt >= attempts) throw new WorkerError(kind);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  const jobPath = (id: string) => `/jobs/${encodeURIComponent(id)}`;

  return {
    async health() {
      return readJson(await send("/health", { method: "GET", timeout: WORKER_TIMEOUTS.get }), workerHealthSchema);
    },
    async createInput(bytes, contentType) {
      // ArrayBuffer 기반 사본으로 보낸다(Buffer·SharedArrayBuffer 뷰도 받을 수 있게)
      const body = new Uint8Array(bytes);
      return readJson(await send("/inputs", { method: "POST", timeout: WORKER_TIMEOUTS.create, body, contentType }), workerInputSchema);
    },
    async createJob(req) {
      const res = await send("/jobs", { method: "POST", timeout: WORKER_TIMEOUTS.create, body: JSON.stringify(req), contentType: "application/json" });
      return readJson(res, workerJobAcceptedSchema);
    },
    async getJob(id) {
      return readJson(await send(jobPath(id), { method: "GET", timeout: WORKER_TIMEOUTS.get }), workerJobStatusSchema);
    },
    async getOutput(id) {
      const res = await send(`${jobPath(id)}/output`, { method: "GET", timeout: WORKER_TIMEOUTS.download });
      if (!res.ok) throw await httpError(res);
      // 프록시의 HTML·JSON 이나 지나치게 큰 본문을 이미지로 저장하지 않는다
      const contentType = res.headers.get("content-type") ?? "";
      const declared = Number(res.headers.get("content-length") ?? "0");
      if (!contentType.startsWith("image/png") || declared > WORKER_OUTPUT_MAX_BYTES) {
        await res.body?.cancel();
        throw new WorkerError("invalid_response");
      }
      return readLimited(res, WORKER_OUTPUT_MAX_BYTES);
    },
    async cancelJob(id) {
      return readJson(await send(jobPath(id), { method: "DELETE", timeout: WORKER_TIMEOUTS.create }), workerCancelSchema);
    },
  };
}

let cachedClient: WorkerClient | null = null;

// 서버 전용. GPU_API_URL·GPU_API_TOKEN 으로 만든 클라이언트를 모듈 안에서 하나만 쓴다
export function getWorkerClient(): WorkerClient {
  if (cachedClient) return cachedClient;
  const baseUrl = process.env.GPU_API_URL;
  const token = process.env.GPU_API_TOKEN;
  if (!baseUrl || !token) throw new Error("GPU_API_URL·GPU_API_TOKEN 환경변수가 필요해요");
  cachedClient = createWorkerClient({ baseUrl, token });
  return cachedClient;
}
