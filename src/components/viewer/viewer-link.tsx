"use client";

import type { ComponentProps, MouseEvent } from "react";

import { preloadViewer } from "@/components/viewer/viewer-slot";

// 뷰어를 여는 링크. 일반 클릭은 지금 주소(검색·필터)에 image 만 더해 history.pushState 로 주소만 바꿔 연다 — Next 가 useSearchParams 와 맞추고
// 페이지를 서버에서 다시 그리지 않는다. 새 탭·창으로 여는 클릭(수정 키·가운데 버튼)은 보통 링크(?image= 만)로 둔다.
// 주소를 렌더 때 읽지 않아 검색어가 바뀌어도 타일을 다시 그리지 않는다. 올리거나 포커스하면 뷰어 코드를 미리 받는다
export function ViewerLink({ imageId, onClick, ...props }: Omit<ComponentProps<"a">, "href"> & { imageId: string }) {
  function open(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    params.set("image", imageId);
    window.history.pushState(null, "", `?${params.toString()}`);
  }
  return <a onMouseEnter={preloadViewer} onFocus={preloadViewer} {...props} href={`?image=${imageId}`} onClick={open} />;
}
