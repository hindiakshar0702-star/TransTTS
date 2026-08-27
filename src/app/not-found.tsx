import Link from "next/link";

export default function NotFound() {
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
        <div style={{ fontSize: "4rem", fontWeight: 800, color: "var(--accent)", lineHeight: 1 }}>
          404
        </div>
        <h1 style={{ marginTop: 12, fontSize: "1.5rem", fontWeight: 700 }}>Page not found</h1>
        <p style={{ color: "var(--text-dim)", marginTop: 8, maxWidth: 380 }}>
          This page doesn&apos;t exist or was moved. Check the address, or head back home.
        </p>
        <Link
          href="/"
          className="btn btn-primary"
          style={{ marginTop: 24, display: "inline-flex" }}
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
