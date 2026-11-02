import { type ReactNode, Suspense } from "react";

import { AppSidebar } from "@/components/shell/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ImageViewerDialog } from "@/components/viewer/image-viewer-dialog";

// 앱 틀: 사이드바(모바일은 시트) + 본문 + 이미지 뷰어(?image= 딥링크). 경로·주소를 읽는 부분은 Suspense 안에 둔다
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
      <Suspense fallback={null}>
        <ImageViewerDialog />
      </Suspense>
    </SidebarProvider>
  );
}
