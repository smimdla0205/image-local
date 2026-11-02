import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import "./globals.css";

// 디자인 시스템 글꼴. globals.css 의 --font-sans 가 Inter, Pretendard 순서로 쌓아 영문·숫자는 Inter, 한글은 Pretendard 로 그린다
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Pretendard 가변 글꼴. SIL OFL 1.1 이고 원문은 같은 폴더의 Pretendard-OFL.txt
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  weight: "45 920",
  variable: "--font-pretendard",
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
      className={`${inter.variable} ${pretendard.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
