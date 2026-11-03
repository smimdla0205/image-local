"use client";

// 루트 layout 자체가 깨졌을 때의 최후 경계. layout 을 대체하므로 html·body 를 직접 그린다
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <main style={{ textAlign: "center", padding: 32 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>문제가 생겼어요</h1>
          <p style={{ margin: "0 0 16px", opacity: 0.7 }}>
            잠시 뒤 다시 시도해 주세요.
            {error.digest ? ` (오류 코드: ${error.digest})` : null}
          </p>
          <button type="button" onClick={() => retry()}>
            다시 시도
          </button>
        </main>
      </body>
    </html>
  );
}
