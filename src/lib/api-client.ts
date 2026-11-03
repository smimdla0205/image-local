// 브라우저 → 앱 API 호출. 오류 응답({ error: { code, message } })은 ApiClientError 로 바꾼다
import type { ApiErrorBody } from "@/lib/jobs/schemas";

export const FALLBACK_MESSAGE = "문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.";
const NETWORK_MESSAGE = "서버에 연결할 수 없어요. 잠시 뒤 다시 시도해 주세요.";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

// 없는 것(404). 다시 물어도 같으므로 재시도하지 않고, 화면은 '찾을 수 없어요'로 안내한다
export function isNotFound(e: unknown): boolean {
  return e instanceof ApiClientError && e.status === 404;
}

// 알림에 쓸 문구. API·네트워크 오류는 그 문구를, 그 밖의 오류는 fallback 을 쓴다
export function errorMessage(e: unknown, fallback = FALLBACK_MESSAGE): string {
  return e instanceof ApiClientError ? e.message : fallback;
}

export async function apiFetch<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(path, {
      ...rest,
      headers: json === undefined ? headers : { "content-type": "application/json", ...headers },
      body: json === undefined ? rest.body : JSON.stringify(json),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiClientError(0, "network_error", NETWORK_MESSAGE);
  }
  if (!res.ok) {
    let body: Partial<ApiErrorBody> = {};
    try {
      body = await res.json();
    } catch {
      // JSON 이 아닌 오류 응답(프록시 등)은 기본 문구로 알린다
    }
    throw new ApiClientError(res.status, body.error?.code ?? "internal_error", body.error?.message ?? FALLBACK_MESSAGE);
  }
  return (await res.json()) as T;
}
