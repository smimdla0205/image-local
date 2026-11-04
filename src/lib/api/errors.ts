// API 오류 응답과 라우트 공통 처리. 단위 테스트가 별칭 없이 불러오므로 이 파일은 상대 경로 import 만 쓴다
import { unstable_rethrow } from "next/navigation";
import { type z, ZodError } from "zod";

// 사용자에게 그대로 보이는 문구(해요체)
export const ERROR_MESSAGES: Record<string, string> = {
  invalid_request: "입력을 확인해 주세요.",
  file_required: "사진 파일을 골라 주세요.",
  unsupported_media_type: "PNG, JPEG, WebP 사진만 올릴 수 있어요.",
  file_too_large: "20MB 이하 사진만 올릴 수 있어요.",
  invalid_image: "사진을 읽을 수 없어요. 다른 파일을 올려 주세요.",
  model_cannot_edit: "MOSS-Image 는 이미지를 고치지 않아요. 새 대화에서 다른 모델을 고르세요.",
  transparent_not_supported: "이 모델은 투명 배경을 지원하지 않아요.",
  input_image_not_found: "고칠 이미지를 찾을 수 없어요.",
  conversation_not_found: "찾을 수 없어요.",
  conversation_in_trash: "대화가 휴지통에 있어요. 대화를 먼저 복구해 주세요.",
  job_not_found: "찾을 수 없어요.",
  image_not_found: "찾을 수 없어요.",
  not_found: "찾을 수 없어요.",
  too_many_active_jobs: "지금 진행 중인 작업이 많아요. 잠시 뒤 다시 시도해 주세요.",
  job_finished: "이미 끝난 작업이에요.",
  worker_unreachable: "GPU 워커에 연결할 수 없어요. 잠시 뒤 다시 시도해 주세요.",
  forbidden: "허용되지 않은 요청이에요.",
  internal_error: "문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.",
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message?: string) {
    super(message ?? ERROR_MESSAGES[code] ?? ERROR_MESSAGES.internal_error);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function jsonError(status: number, code: string, message?: string): Response {
  return Response.json({ error: { code, message: message ?? ERROR_MESSAGES[code] ?? ERROR_MESSAGES.internal_error } }, { status });
}

// JSON 본문을 읽어 스키마로 검증한다. JSON 이 아니면 400 invalid_request, 스키마 오류는 handleRoute 가 400 으로 바꾼다.
// Content-Type 을 application/json 으로 한정해 다른 사이트의 폼·sendBeacon 같은 단순 요청(사전 확인 없음)을 받지 않는다
export async function parseJsonBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.output<S>> {
  const contentType = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new ApiError(400, "invalid_request");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "invalid_request");
  }
  return schema.parse(body);
}

// Next 의 전역 RouteContext 는 루트 tsc(단위 테스트)에서 보이지 않아 같은 모양을 직접 둔다
export type RouteCtx = { params: Promise<Record<string, string>> };
type RouteFn = (req: Request, ctx: RouteCtx) => Promise<Response>;

// v1 은 로컬 단일 사용자 앱이라 사용자 인증이 없다. 대신 아래 검사로 다른 사이트가 이 앱을 부르지 못하게 한다
// Host(포트 포함)는 이 형식과 정확히 같아야 한다
const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/i;
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SAME_SITE_VALUES = new Set(["same-origin", "none"]);

function isLocalOrigin(origin: string): boolean {
  try {
    return LOCAL_HOST_RE.test(new URL(origin).host);
  } catch {
    // "null"(샌드박스 iframe·file://) 같은 값
    return false;
  }
}

// 다른 사이트가 브라우저로 보낸 상태 변경 요청인가. Sec-Fetch-Site 가 있으면 그것으로, 없으면(오래된 브라우저) Origin 으로 판단한다.
// 둘 다 없는 요청(curl·서버 호출)은 브라우저 CSRF 가 아니므로 통과한다
function isCrossSiteMutation(req: Request): boolean {
  if (!MUTATING_METHODS.has(req.method)) return false;
  const site = req.headers.get("sec-fetch-site");
  if (site) return !SAME_SITE_VALUES.has(site);
  const origin = req.headers.get("origin");
  return origin !== null && !isLocalOrigin(origin);
}

export function handleRoute(name: string, fn: RouteFn): RouteFn {
  return async (req, ctx) => {
    try {
      // DNS 리바인딩: 다른 도메인 이름으로 이 서버에 닿은 요청은 거절한다
      if (!LOCAL_HOST_RE.test(req.headers.get("host") ?? "")) return jsonError(403, "forbidden");
      // CSRF: 브라우저가 다른 사이트에서 보낸 상태 변경 요청을 거절한다
      if (isCrossSiteMutation(req)) return jsonError(403, "forbidden");
      return await fn(req, ctx);
    } catch (err) {
      // Next 의 내부 신호(빌드 때 미리 렌더링 중단, notFound 등)는 오류 응답으로 바꾸지 않고 Next 에 돌려준다
      unstable_rethrow(err);
      if (err instanceof ApiError) return jsonError(err.status, err.code, err.message);
      // zod 의 영문 메시지는 싣지 않는다
      if (err instanceof ZodError) return jsonError(400, "invalid_request");
      logErrorKind("[api]", err, name);
      return jsonError(500, "internal_error");
    }
  };
}

// 오류는 이름·코드만 남긴다(message·stack 에 프롬프트·경로가 섞일 수 있다). id 는 잡·라우트 이름 같은 짧은 식별자
export function logErrorKind(tag: string, e: unknown, id?: string): void {
  const err = e as { name?: unknown; code?: unknown } | null;
  console.error(tag, ...(id === undefined ? [] : [id]), err?.name, err?.code);
}
