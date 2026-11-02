// API 오류 응답과 라우트 공통 처리. 단위 테스트가 별칭 없이 불러오므로 이 파일은 상대 경로 import 만 쓴다
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

// JSON 본문을 읽어 스키마로 검증한다. JSON 이 아니면 400 invalid_request, 스키마 오류는 handleRoute 가 400 으로 바꾼다
export async function parseJsonBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.output<S>> {
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

// v1 은 로컬 단일 사용자 앱이라 사용자 인증이 없다. 대신 이 두 검사로 다른 사이트가 이 앱을 부르지 못하게 한다
const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SAME_SITE_VALUES = new Set(["same-origin", "none"]);

function hostnameOf(host: string | null): string {
  if (!host) return "";
  // [::1]:3000 → [::1], localhost:3000 → localhost
  return host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
}

export function handleRoute(name: string, fn: RouteFn): RouteFn {
  return async (req, ctx) => {
    try {
      // DNS 리바인딩: 다른 도메인 이름으로 이 서버에 닿은 요청은 거절한다
      if (!ALLOWED_HOSTS.has(hostnameOf(req.headers.get("host")).toLowerCase())) return jsonError(403, "forbidden");
      // CSRF: 브라우저가 다른 사이트에서 보낸 상태 변경 요청을 거절한다(헤더가 없는 curl·서버 호출은 통과)
      const site = req.headers.get("sec-fetch-site");
      if (MUTATING_METHODS.has(req.method) && site && !SAME_SITE_VALUES.has(site)) return jsonError(403, "forbidden");
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) return jsonError(err.status, err.code, err.message);
      // zod 의 영문 메시지는 싣지 않는다
      if (err instanceof ZodError) return jsonError(400, "invalid_request");
      // message·stack 은 남기지 않는다(Prisma 메시지에 프롬프트가 섞일 수 있다)
      const e = err as { name?: unknown; code?: unknown };
      console.error("[api]", name, e?.name, e?.code);
      return jsonError(500, "internal_error");
    }
  };
}
