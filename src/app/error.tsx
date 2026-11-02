"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

// 하위 라우트에서 잡히지 않은 런타임 오류를 감싸는 경계. 루트 layout 의 오류는 global-error.tsx 가 받는다
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlert />
          </EmptyMedia>
          <EmptyTitle>문제가 생겼습니다</EmptyTitle>
          <EmptyDescription>
            잠시 후 다시 시도해 주세요.
            {error.digest ? ` (오류 코드: ${error.digest})` : null}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => reset()}>다시 시도</Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
