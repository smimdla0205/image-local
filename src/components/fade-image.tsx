"use client";

import { cn } from "cn";
import { type ComponentProps, useCallback, useState } from "react";

// 다 받기 전에는 투명하게 두고(data-loading — 자리는 바깥 .image-frame 이 깜빡인다) 다 받으면 짧게 나타낸다. 못 받아도 깜빡임은 멈춘다.
// 서버가 그린 이미지가 hydration 전에 이미 다 왔으면 load 이벤트를 놓치므로 ref 에서 complete 로 알아챈다. src 가 바뀌면 다시 받는 중이 된다
export function FadeImage({ src, alt, className, ...props }: ComponentProps<"img"> & { src: string; alt: string }) {
  const [doneSrc, setDoneSrc] = useState<string | null>(null);
  const finish = () => setDoneSrc(src);
  // src 가 같으면 렌더마다 다시 붙지 않게 고정한다
  const ref = useCallback(
    (el: HTMLImageElement | null) => {
      if (el?.complete) setDoneSrc(src);
    },
    [src],
  );
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 앱이 서빙하는 이미지(크기가 정해진 WebP·PNG)라 next/image 최적화가 필요 없다
    <img
      {...props}
      src={src}
      alt={alt}
      ref={ref}
      onLoad={finish}
      onError={finish}
      data-loading={doneSrc === src ? undefined : ""}
      className={cn("fade-image", className)}
    />
  );
}
