import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // 상위 작업공간(AI/)에도 package-lock.json 이 있어 자동 감지가 그쪽을 루트로 잡지 않게 고정한다
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // 다른 사이트가 이 앱을 iframe 에 넣지 못하게 한다(클릭재킹 — iframe 안 요청은 같은 출처라 CSRF 검사를 통과한다)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
