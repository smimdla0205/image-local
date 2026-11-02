// 앱 전체 활성 잡 상한. 단위 테스트가 불러오므로 상대 경로 import 만 쓴다
import { ApiError } from "../api/errors";

export const ACTIVE_JOB_CAP = 20;
// 이 시간보다 오래된 QUEUED·RUNNING 잡은 버려진 것으로 보고 세지 않는다(영구 429 방지)
export const ACTIVE_WINDOW_MS = 2 * 60 * 60 * 1000;

// active = 최근 ACTIVE_WINDOW_MS 안에 만들어진 QUEUED·RUNNING 잡 수
export function assertCapacity(active: number, requested: number): void {
  if (active + requested > ACTIVE_JOB_CAP) throw new ApiError(429, "too_many_active_jobs");
}
