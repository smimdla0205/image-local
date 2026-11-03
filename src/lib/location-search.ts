import { useSyncExternalStore } from "react";

// 브라우저 주소의 쿼리스트링(?…)을 읽는다. useSearchParams 와 달리 Suspense 가 필요 없어 그 부분이 정적 셸(첫 HTML)에 들어간다.
// 서버와 hydration 때는 빈 값이고 그 뒤 실제 값으로 한 번 다시 그린다. 뒤로·앞으로 가기(popstate)와 replaceSearch 를 따라간다
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

export function useLocationSearch(): string {
  return useSyncExternalStore(subscribe, () => window.location.search, () => "");
}

// 쿼리스트링만 바꾼다(history.replaceState — Next 가 useSearchParams 를 맞추고 페이지를 서버에서 다시 그리지 않는다). 빈 값이면 경로만 남긴다
export function replaceSearch(query: string): void {
  window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  for (const listener of listeners) listener();
}
