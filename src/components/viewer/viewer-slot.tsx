"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { parseId } from "@/lib/jobs/constants";

// 뷰어 코드(다이얼로그·정보 패널·삭제 확인창)는 ?image= 로 처음 열 때 받는다. 딥링크는 서버에서 그려 첫 화면부터 보인다
const load = () => import("@/components/viewer/image-viewer-dialog");
const ImageViewerDialog = dynamic(() => load().then((m) => m.ImageViewerDialog));

// 뷰어를 여는 링크에 마우스를 올리거나 포커스하면 미리 받아 둔다(누를 때 기다리지 않는다)
export function preloadViewer() {
  void load();
}

export function ViewerSlot() {
  const searchParams = useSearchParams();
  const id = parseId(searchParams.get("image"));
  // 한 번 열리면 닫힌 뒤에도 그대로 둔다(닫힘 전환이 끝까지 보이고, 다시 열 때 바로 뜬다)
  const [mounted, setMounted] = useState(false);
  if (id && !mounted) setMounted(true);
  return mounted ? <ImageViewerDialog /> : null;
}
