"use client";

import type { ComponentProps, MouseEvent } from "react";

// 뷰어를 여는 링크(?image= 만 바꾼다). 일반 클릭은 history.pushState 로 주소만 바꿔 연다 — Next 가 useSearchParams 와 맞추고
// 페이지를 서버에서 다시 그리지 않는다. 새 탭·창으로 여는 클릭(수정 키·가운데 버튼)은 보통 링크처럼 둔다
export function ViewerLink({ href, onClick, ...props }: ComponentProps<"a"> & { href: string }) {
  function open(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    window.history.pushState(null, "", href);
  }
  return <a {...props} href={href} onClick={open} />;
}
