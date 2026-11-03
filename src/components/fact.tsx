import type { ReactNode } from "react";

// 확인창(대화·이미지 삭제)의 안내 한 줄: 아이콘 + 문구
export function Fact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  );
}
