"use client";

import { useQuery } from "@tanstack/react-query";
import { ImagesIcon, SquarePenIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { FadeImage } from "@/components/fade-image";
import { groupByDay } from "@/components/shell/day-groups";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarResizeHandle,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { LoadError } from "@/components/ui/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import type { ConversationListDto } from "@/lib/jobs/schemas";
import { queryKeys } from "@/lib/query-keys";

function Brand() {
  return (
    <Link href="/" className="rounded-md px-2 text-base font-bold tracking-tight outline-none focus-visible:shadow-focus-ring">
      imagen-local
    </Link>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-2" aria-busy="true">
      <span className="sr-only">불러오는 중…</span>
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} aria-hidden="true" className="h-8" />
      ))}
    </div>
  );
}

// 대화 목록. 날짜 묶음은 데이터가 온 뒤 브라우저 시간으로 계산한다(서버 렌더는 스켈레톤)
function ConversationList() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const list = useQuery({ queryKey: queryKeys.conversations.list(), queryFn: () => apiFetch<ConversationListDto>("/api/conversations") });

  if (list.isPending) return <ListSkeleton />;
  if (list.isError) return <LoadError message="목록을 불러오지 못했어요" onRetry={() => void list.refetch()} />;
  if (list.data.items.length === 0)
    return (
      <div className="flex flex-col gap-1 px-2 text-caption">
        <p className="text-muted-foreground">아직 대화가 없어요</p>
        <Link href="/" onClick={() => setOpenMobile(false)} className="self-start rounded-sm text-label underline underline-offset-4 outline-none focus-visible:shadow-focus-ring">
          새 대화
        </Link>
      </div>
    );
  return (
    <>
      {groupByDay(list.data.items, new Date()).map((group) => (
        <section key={group.label} className="flex flex-col gap-0.5">
          <h2 className="px-2 pb-1 text-micro text-muted-foreground">{group.label}</h2>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((c) => {
              const href = `/c/${c.id}`;
              const title = c.title ?? "제목 없음";
              return (
                <li key={c.id}>
                  <Link
                    href={href}
                    aria-current={pathname === href ? "page" : undefined}
                    // 잘린 제목은 마우스를 올리면 전체를 보인다
                    title={title}
                    onClick={() => setOpenMobile(false)}
                    className="flex min-h-9 items-center gap-2.5 rounded-md px-2 py-1.5 text-label font-normal outline-none hover:bg-sidebar-accent focus-visible:shadow-focus-ring aria-[current=page]:bg-sidebar-accent max-md:min-h-11"
                  >
                    {c.thumbUrl ? (
                      // 대화가 많으면 목록 아래쪽 썸네일은 보일 때 받는다
                      <span className="image-frame size-6 shrink-0 overflow-hidden rounded-sm bg-muted">
                        <FadeImage src={c.thumbUrl} alt="" width={24} height={24} loading="lazy" fetchPriority="low" className="size-full object-cover" />
                      </span>
                    ) : (
                      <span aria-hidden="true" className="size-6 shrink-0 rounded-sm bg-secondary" />
                    )}
                    <span className="min-w-0 truncate">{title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

// 현재 경로를 보는 링크들. usePathname 은 동적 경로(/c/[id])의 미리 렌더링에서 Suspense 가 필요하다
function SidebarNav() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const close = () => setOpenMobile(false);
  return (
    <>
      <nav aria-label="바로가기" className="px-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={pathname === "/"} aria-current={pathname === "/" ? "page" : undefined} render={<Link href="/" onClick={close} />} className="max-md:h-11">
              <SquarePenIcon aria-hidden="true" />
              새 대화
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/gallery"}
              aria-current={pathname === "/gallery" ? "page" : undefined}
              render={<Link href="/gallery" onClick={close} />}
              className="max-md:h-11"
            >
              <ImagesIcon aria-hidden="true" />
              갤러리
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/trash"}
              aria-current={pathname === "/trash" ? "page" : undefined}
              render={<Link href="/trash" onClick={close} />}
              className="max-md:h-11"
            >
              <Trash2Icon aria-hidden="true" />
              휴지통
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </nav>
      <nav aria-label="대화 목록" className="flex flex-col gap-4 px-2">
        <ConversationList />
      </nav>
    </>
  );
}

// 사이드바 틀은 Suspense 밖에 둔다. SidebarProvider 와 같은 hydration 단계에 그려야 모바일 판정(isMobile)이 서버 HTML 과 어긋나지 않는다
export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader className="flex-row items-center justify-between">
        <Brand />
        <SidebarTrigger aria-label="사이드바 접기" className="max-md:hidden" />
      </SidebarHeader>
      <SidebarContent className="gap-4 pb-3">
        <Suspense fallback={<ListSkeleton />}>
          <SidebarNav />
        </Suspense>
      </SidebarContent>
      <SidebarResizeHandle />
    </Sidebar>
  );
}
