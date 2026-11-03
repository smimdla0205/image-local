"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";

// 하위 라우트에서 잡히지 않은 런타임 오류를 감싸는 경계. 루트 layout 의 오류는 global-error.tsx 가 받는다.
// retry 는 서버에서 다시 받아 그린다(reset 은 클라이언트 상태만 지운다)
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlert aria-hidden="true" />
          </EmptyMedia>
          <h1 className="text-title">문제가 생겼어요</h1>
          <EmptyDescription>
            잠시 뒤 다시 시도해 주세요.
            {error.digest ? ` (오류 코드: ${error.digest})` : null}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center">
          <Button onClick={() => retry()}>다시 시도</Button>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            새 대화로
          </Link>
        </EmptyContent>
      </Empty>
    </div>
  );
}
