import type { QueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

// 휴지통으로 옮기거나 되돌린 뒤 새로 받을 것: 갤러리 목록·대화(목록·상세)·휴지통.
// 이미지 단건(뷰어)·참조 수는 지운 id 를 다시 불러 404 가 나지 않게 건드리지 않는다
export function invalidateAfterTrash(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.images.lists });
  void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.trash.all });
}

export function restoreFromTrash(kind: "conversation" | "image", id: string): Promise<unknown> {
  return apiFetch(`/api/${kind === "conversation" ? "conversations" : "images"}/${id}/restore`, { method: "POST" });
}
