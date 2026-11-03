// React Query 키. 무효화할 때 all 접두어로 한 번에 지운다
import type { ModelId } from "@/lib/gpu/models";

export const queryKeys = {
  conversations: {
    all: ["conversations"] as const,
    list: () => ["conversations", "list"] as const,
    details: ["conversations", "detail"] as const,
    detail: (id: string) => ["conversations", "detail", id] as const,
  },
  jobs: {
    detail: (id: string) => ["jobs", id] as const,
  },
  images: {
    all: ["images"] as const,
    lists: ["images", "list"] as const,
    list: (f: { q?: string; model?: ModelId }) => ["images", "list", f] as const,
    detail: (id: string) => ["images", "detail", id] as const,
    // 삭제 확인창이 보여 주는 참조 수
    refs: (id: string) => ["images", "refs", id] as const,
  },
  trash: {
    all: ["trash"] as const,
  },
};
