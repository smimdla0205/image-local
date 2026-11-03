// 휴지통 보관 기간과 미사용 업로드 정리 기준. 단위 테스트가 불러오므로 import 없이 순수 계산만 둔다
export const TRASH_TTL_DAYS = 30;
export const UPLOAD_TTL_HOURS = 24;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

// 휴지통 항목이 자동으로 지워지는 시각
export function trashExpiresAt(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + TRASH_TTL_DAYS * DAY_MS);
}

// 이 시각보다 먼저 휴지통에 들어간 항목은 지운다
export function trashCutoff(now: Date): Date {
  return new Date(now.getTime() - TRASH_TTL_DAYS * DAY_MS);
}

// 대화에 붙지 않은 업로드는 이 시각보다 먼저 올라왔으면 지운다
export function staleUploadCutoff(now: Date): Date {
  return new Date(now.getTime() - UPLOAD_TTL_HOURS * HOUR_MS);
}
