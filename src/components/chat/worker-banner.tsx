import { CloudOffIcon } from "lucide-react";

// 워커에 닿지 못하면 대화 위에 띄운다. 잡은 대기로 남고, 워커가 돌아오면 다음 폴링이 이어서 보낸다
export function WorkerBanner() {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-caption text-foreground">
      <CloudOffIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
      GPU 워커에 연결할 수 없어요. 연결되면 이어서 진행해요.
    </div>
  );
}
