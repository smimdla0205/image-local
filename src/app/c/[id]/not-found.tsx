import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

// 없거나 휴지통에 있는 대화
export default function ConversationNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-205 flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-title">대화를 찾을 수 없어요</h1>
      <p className="text-caption text-muted-foreground">삭제했거나 주소가 바뀌었을 수 있어요. 삭제한 대화는 휴지통에서 복구할 수 있어요.</p>
      <div className="flex gap-2">
        <Link href="/trash" className={buttonVariants({ variant: "outline" })}>
          휴지통
        </Link>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          새 대화
        </Link>
      </div>
    </div>
  );
}
