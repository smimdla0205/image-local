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
import { ApiClientError } from "@/lib/api-client";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // SSR 직후 클라이언트가 같은 데이터를 바로 다시 요청하지 않게 한다
        staleTime: 60 * 1000,
        // 4xx(없음·잘못된 요청)는 다시 물어도 같다. 그 밖(네트워크·5xx)은 잠시 끊긴 것으로 보고 세 번까지
        retry: (count, e) => !(e instanceof ApiClientError && e.status >= 400 && e.status < 500) && count < 3,
      },
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
