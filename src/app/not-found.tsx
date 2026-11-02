import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

// 없는 경로로 들어오거나 notFound() 가 호출됐을 때 보여 주는 화면
export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>페이지를 찾을 수 없습니다</EmptyTitle>
          <EmptyDescription>
            주소가 잘못됐거나 삭제된 대화일 수 있습니다.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button nativeButton={false} render={<Link href="/" />}>
            새 채팅으로
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
