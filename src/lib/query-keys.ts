// React Query 키. 무효화할 때 all 접두어로 한 번에 지운다
import type { ModelId } from "@/lib/gpu/models";

export const queryKeys = {
  conversations: {
    all: ["conversations"] as const,
    list: () => ["conversations", "list"] as const,
    detail: (id: string) => ["conversations", "detail", id] as const,
  },
  jobs: {
    detail: (id: string) => ["jobs", id] as const,
  },
  images: {
    all: ["images"] as const,
    list: (f: { q?: string; model?: ModelId }) => ["images", "list", f] as const,
    detail: (id: string) => ["images", "detail", id] as const,
  },
};
