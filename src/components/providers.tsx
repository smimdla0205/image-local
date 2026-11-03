"use client";

import {
  environmentManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { LucideProvider } from "lucide-react";
import { ThemeProvider } from "next-themes";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // SSR 직후 클라이언트가 같은 데이터를 바로 다시 요청하지 않게 한다
      queries: { staleTime: 60 * 1000 },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

// TanStack Query 의 Next.js App Router 권장 패턴. 서버는 요청마다 새로 만들고,
// 브라우저는 하나를 재사용해 첫 렌더가 suspend 돼도 캐시가 버려지지 않게 한다
function getQueryClient() {
  if (environmentManager.isServer()) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {/* 디자인 시스템 아이콘 규칙: Lucide 선 굵기 1.75. 아이콘에 strokeWidth 를 직접 주면 그 값이 우선한다 */}
        <LucideProvider strokeWidth={1.75}>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster containerAriaLabel="알림" />
        </LucideProvider>
      </ThemeProvider>
      <ReactQueryDevtools />
    </QueryClientProvider>
  );
}
