import { Suspense } from "react";

import { NewChat, NewChatSkeleton } from "@/components/chat/new-chat";

// 새 대화. NewChat 이 ?image= 를 읽으므로(useSearchParams) Suspense 안에 둔다
export default function Home() {
  return (
    <Suspense fallback={<NewChatSkeleton />}>
      <NewChat />
    </Suspense>
  );
}
