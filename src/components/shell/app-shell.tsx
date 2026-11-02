import type { ReactNode } from "react";

import { AppSidebar } from "@/components/shell/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

// 앱 틀: 사이드바(모바일은 시트) + 본문. 경로를 읽는 부분은 각 컴포넌트 안의 Suspense 가 감싼다
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
