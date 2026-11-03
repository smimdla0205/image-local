import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/shell/app-shell";
// Pretendard 가변 글꼴의 공식 dynamic subset(1.3.9, SIL OFL 1.1 — 원문은 같은 폴더의 Pretendard-OFL.txt).
// 글자 범위별 조각(92개)이라 브라우저는 화면에 쓰인 글자가 든 조각만 받는다
import "./fonts/pretendardvariable-dynamic-subset.css";
import "./globals.css";

// 디자인 시스템 글꼴. globals.css 의 --font-sans 가 Inter, Pretendard Variable 순서로 쌓아 영문·숫자는 Inter, 한글은 Pretendard 로 그린다
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "imagen-local",
  description: "오픈소스 이미지 모델 채팅",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes 가 html 의 class 를 바꾸므로 이 요소만 hydration 경고에서 뺀다
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
