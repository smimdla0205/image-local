"use client";

import { LockIcon, SquarePenIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { getModel, type ModelId } from "@/lib/gpu/models";

const ICON_CLASS = "max-md:size-11";

// 화면 상단. 모바일은 메뉴(사이드바 시트)와 새 대화, 데스크톱은 사이드바를 접었을 때만 여는 버튼을 보인다.
// 열기 버튼의 data-sidebar-open-trigger 는 접을 때 SidebarProvider 가 포커스를 옮기는 대상이다
export function Topbar({ title, hideTitle = false, model, actions }: { title: string; hideTitle?: boolean; model?: ModelId; actions?: ReactNode }) {
  const { state } = useSidebar();
  return (
    <header className="sticky top-0 z-10 flex min-h-14 items-center gap-2 bg-background px-4 py-2">
      <SidebarTrigger aria-label="메뉴 열기" className={`md:hidden ${ICON_CLASS}`} />
      {state === "collapsed" && <SidebarTrigger data-sidebar-open-trigger="" aria-label="사이드바 열기" className="max-md:hidden" />}
      <h1 className={hideTitle ? "sr-only" : "min-w-0 truncate text-base font-semibold"}>{title}</h1>
      {model && (
        <span className="inline-flex shrink-0 items-center gap-1 text-caption text-muted-foreground" title="이 대화의 모델이에요. 다른 모델은 새 대화에서 골라요.">
          <LockIcon aria-hidden="true" className="size-3.5" />
          <span className="sr-only">이 대화의 모델 </span>
          {getModel(model).name}
        </span>
      )}
      <span className="flex-1" />
      {actions}
      <Link
        href="/"
        aria-label="새 대화"
        className="inline-grid size-9 place-items-center rounded-md outline-none hover:bg-secondary focus-visible:shadow-focus-ring md:hidden max-md:size-11"
      >
        <SquarePenIcon aria-hidden="true" className="size-[18px]" />
      </Link>
    </header>
  );
}
