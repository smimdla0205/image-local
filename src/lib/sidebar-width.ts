// 사이드바 너비(rem). 쿠키 sidebar_width 로 유지한다. 단위 테스트가 불러오므로 import 가 없다
export const SIDEBAR_WIDTH_DEFAULT = 16;
export const SIDEBAR_WIDTH_MIN = 12;
export const SIDEBAR_WIDTH_MAX = 24;
// 방향키 한 번에 움직이는 양(rem)
export const SIDEBAR_WIDTH_STEP = 1;
export const SIDEBAR_WIDTH_COOKIE = "sidebar_width";

// 숫자가 아니면 기본값, 범위 밖이면 경계값
export function clampSidebarWidth(raw: unknown): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number.parseFloat(raw) : Number.NaN;
  if (!Number.isFinite(n)) return SIDEBAR_WIDTH_DEFAULT;
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, n));
}

export function readSidebarWidthCookie(cookie: string): number {
  const match = cookie.match(/(?:^|; )sidebar_width=([^;]*)/);
  return clampSidebarWidth(match ? match[1] : undefined);
}
