"use client";

import { cn } from "cn";
import { CircleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  message: string;
  onRetry: () => void;
  // start: 사이드바처럼 왼쪽 정렬, center: 본문 가운데
  align?: "start" | "center";
  className?: string;
};

// 목록·단건을 불러오지 못했을 때. 무슨 일인지와 다시 시도할 길을 같이 둔다
export function LoadError({ message, onRetry, align = "start", className }: Props) {
  return (
    <div role="alert" className={cn("flex flex-wrap items-center gap-2 text-caption", align === "center" ? "justify-center py-16 text-center" : "px-2", className)}>
      <CircleAlertIcon aria-hidden="true" className="size-4 shrink-0 text-destructive" />
      <span>{message}</span>
      <Button type="button" variant="outline" size="sm" onClick={onRetry} className="max-md:h-11">
        다시 불러오기
      </Button>
    </div>
  );
}
