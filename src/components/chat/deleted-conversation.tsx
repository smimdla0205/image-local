import { Trash2Icon } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

// 보고 있던 대화가 다른 곳(다른 탭)에서 휴지통으로 갔을 때 스레드 자리에 보인다
export function DeletedConversation() {
  return (
    <Empty className="border py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Trash2Icon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>삭제된 대화예요</EmptyTitle>
        <EmptyDescription>휴지통에서 복구하거나 새 대화를 시작하세요</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        <Link href="/trash" className={buttonVariants({ variant: "outline" })}>
          휴지통
        </Link>
        <Link href="/" className={buttonVariants({ variant: "default" })}>
          새 대화
        </Link>
      </EmptyContent>
    </Empty>
  );
}
