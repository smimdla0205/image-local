import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { ConversationView, ThreadSkeleton } from "@/components/chat/conversation-view";
import { getConversationDetail, toConversationDetailDto } from "@/lib/jobs/queries";

// 대화 화면. 매 요청 새 데이터라 "use cache" 없이 Suspense 안에서 스트리밍한다(08-caching: Streaming uncached data)
export default function ConversationPage({ params }: PageProps<"/c/[id]">) {
  return (
    <Suspense fallback={<ThreadSkeleton />}>
      <ConversationLoader params={params} />
    </Suspense>
  );
}

async function ConversationLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // better-sqlite3 는 동기 DB 라 요청 시점 렌더임을 먼저 알린다(08-caching: Predictable values)
  await connection();
  const data = await getConversationDetail(id);
  if (!data) notFound();
  // 첫 화면은 DB 기준. 진행 중인 잡이 있으면 클라이언트가 바로 다시 불러 워커와 맞춘다.
  // key: 다른 대화로 옮기면 고칠 이미지 같은 대화별 상태를 새로 시작한다
  return <ConversationView key={id} id={id} initialData={toConversationDetailDto(data.conversation, data.jobs, { reachable: true })} />;
}
