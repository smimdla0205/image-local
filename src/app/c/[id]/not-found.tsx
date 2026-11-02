import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function ConversationNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-205 flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-title">대화를 찾을 수 없어요</h1>
      <p className="text-caption text-muted-foreground">지웠거나 주소가 바뀌었을 수 있어요.</p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        새 대화
      </Link>
    </div>
  );
}
