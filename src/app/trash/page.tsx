import { TrashView } from "@/components/trash/trash-view";

// 휴지통. 목록은 클라이언트가 받는다(30일 뒤 자동 정리는 그 요청이 처리한다)
export default function TrashPage() {
  return <TrashView />;
}
