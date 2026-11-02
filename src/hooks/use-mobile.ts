import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

// shadcn 원본은 effect 안에서 setState 를 불러 react-hooks/set-state-in-effect 에 걸린다.
// 같은 동작을 React 의 외부 구독 API 로 구현했다. shadcn add --overwrite 로 덮어쓰지 않는다
function subscribe(onChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MOBILE_QUERY).matches,
    // 서버 렌더와 첫 hydration 은 데스크톱으로 그린다 (원본과 같은 초기값)
    () => false
  )
}
