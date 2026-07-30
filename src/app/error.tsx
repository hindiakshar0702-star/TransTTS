"use client";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log for diagnostics; never surface the raw message to the user.
    console.error(error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        textAlign: "center",
      }}
    >
      <div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ color: "var(--text-dim)", marginTop: 8, maxWidth: 400 }}>
          An unexpected error occurred. Try again, or head back home.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
          <button onClick={reset} className="btn btn-primary">
            Try again
          </button>
          {/* Full-page nav (not next/link) is deliberate here — it forces a
              clean reload out of the crashed client subtree. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="btn btn-outline">
            Go home
          </a>
        </div>
      </div>
    </main>
  );
}
