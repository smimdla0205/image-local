import { NewChat } from "@/components/chat/new-chat";

// 새 대화. 주소(?edit=)는 NewChat 이 브라우저에서 읽으므로 Suspense 없이 정적 셸에 그대로 들어간다
export default function Home() {
  return <NewChat />;
}
