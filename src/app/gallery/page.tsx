import { GalleryView } from "@/components/gallery/gallery-view";

// 갤러리. 검색·필터는 정적 셸에 들어가고, 주소를 읽는 목록만 GalleryView 안의 Suspense 에 있다
export default function GalleryPage() {
  return <GalleryView />;
}
