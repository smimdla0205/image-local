import { type ReactNode, Suspense } from "react";

import { AppSidebar } from "@/components/shell/app-sidebar";
import { SkipLink } from "@/components/shell/skip-link";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ViewerSlot } from "@/components/viewer/viewer-slot";
import { LocationSync } from "@/lib/location-search";

// 앱 틀: 건너뛰기 링크 + 사이드바(모바일은 시트) + 본문(#main) + 이미지 뷰어(?image= 딥링크). 경로·주소를 읽는 부분은 Suspense 안에 둔다
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <SkipLink />
      <AppSidebar />
      <SidebarInset id="main" tabIndex={-1} className="outline-none">
        {children}
      </SidebarInset>
      <Suspense fallback={null}>
        <LocationSync />
        <ViewerSlot />
      </Suspense>
    </SidebarProvider>
  );
}
