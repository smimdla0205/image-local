"use client";

// 첫 Tab 에 보이는 본문 건너뛰기. 사이드바 링크(최대 60개)를 지나지 않고 본문으로 간다. 대상(#main, tabIndex -1)에 포커스를 직접 준다
export function SkipLink() {
  return (
    <a
      href="#main"
      onClick={(e) => {
        const main = document.getElementById("main");
        if (!main) return;
        e.preventDefault();
        main.focus();
        main.scrollIntoView();
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:border focus:bg-card focus:px-3 focus:py-2 focus:text-label focus:shadow-focus-ring focus:outline-none"
    >
      본문으로 건너뛰기
    </a>
  );
}
