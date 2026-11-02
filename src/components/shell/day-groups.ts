// 목록을 사용자 시간대 기준 오늘·어제·이전으로 묶는다(단위 테스트가 불러오므로 import 가 없다)
export type DayLabel = "오늘" | "어제" | "이전";

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// getDate 가 고른 ISO 시각으로 묶는다. 순서는 그대로, 빈 묶음은 뺀다
export function groupByDate<T>(items: T[], now: Date, getDate: (item: T) => string): { label: DayLabel; items: T[] }[] {
  const today = startOfDay(now);
  const yesterday = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const groups: Record<DayLabel, T[]> = { 오늘: [], 어제: [], 이전: [] };
  for (const item of items) {
    const day = startOfDay(new Date(getDate(item)));
    groups[day >= today ? "오늘" : day >= yesterday ? "어제" : "이전"].push(item);
  }
  return (["오늘", "어제", "이전"] as const).filter((label) => groups[label].length > 0).map((label) => ({ label, items: groups[label] }));
}

// 사이드바 대화 목록(최근 활동 시각 기준)
export function groupByDay<T extends { updatedAt: string }>(items: T[], now: Date): { label: DayLabel; items: T[] }[] {
  return groupByDate(items, now, (item) => item.updatedAt);
}
