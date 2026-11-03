"use client";

import { cn } from "cn";
import { type ComponentProps, useCallback, useState } from "react";

// 받는 동안에는 투명하게 두고(data-loading — 자리는 바깥 .image-frame 이 깜빡인다) 다 받으면 짧게 나타낸다. 못 받아도 깜빡임은 멈춘다.
// 첫 렌더(서버 HTML 포함)에는 data-loading 을 두지 않는다: 서버가 그린 이미지가 hydration 을 기다리지 않고 바로 보이게(LCP).
// 클라이언트에서 붙을 때 아직 다 받지 않았으면(ref 에서 complete 확인) 그때부터 받는 중으로 표시한다. src 가 바뀌면 다시 받는 중이 된다
export function FadeImage({ src, alt, className, ...props }: ComponentProps<"img"> & { src: string; alt: string }) {
  const [loadingSrc, setLoadingSrc] = useState<string | null>(null);
  const finish = () => setLoadingSrc((current) => (current === src ? null : current));
  // src 가 같으면 렌더마다 다시 붙지 않게 고정한다
  const ref = useCallback(
    (el: HTMLImageElement | null) => {
      if (el && !el.complete) setLoadingSrc(src);
    },
    [src],
  );
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 앱이 서빙하는 이미지(크기가 정해진 WebP·PNG)라 next/image 최적화가 필요 없다
    <img
      decoding="async"
      {...props}
      src={src}
      alt={alt}
      ref={ref}
      onLoad={finish}
      onError={finish}
      data-loading={loadingSrc === src ? "" : undefined}
      className={cn("fade-image", className)}
    />
  );
}
