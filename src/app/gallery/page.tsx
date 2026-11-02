import { Suspense } from "react";

import { GallerySkeleton, GalleryView } from "@/components/gallery/gallery-view";

// 갤러리. 검색·필터를 주소에서 읽으므로(useSearchParams) Suspense 안에 둔다
export default function GalleryPage() {
  return (
    <Suspense fallback={<GallerySkeleton />}>
      <GalleryView />
    </Suspense>
  );
}
