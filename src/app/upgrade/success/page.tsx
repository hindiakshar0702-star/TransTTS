"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";

interface OrderView {
  id: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  plan: string;
  planName: string;
  cycle: string;
  amount: number; // paise
  currency: string;
  status: string;
  userEmail: string | null;
  userName: string | null;
  validUntil: string | null;
  createdAt: string;
}

export default function UpgradeSuccessPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--bg)" }} />}>
      <SuccessContent />
    </Suspense>
  );
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const fallbackPlan = searchParams.get("plan");
  const fallbackCycle = searchParams.get("cycle");
  const paymentId = searchParams.get("paymentId");

  const [order, setOrder] = useState<OrderView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/razorpay/order/${encodeURIComponent(orderId)}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Could not fetch order (${res.status})`);
        }
        const data: OrderView = await res.json();
        if (!cancelled) setOrder(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load order");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  /* ------------------ Render states ----------------- */

  // 1) Direct landing without orderId
  if (!orderId) {
    return (
      <>
        <Navbar />
        <main className="app-page">
          <div className="container" style={{ maxWidth: 640 }}>
            <div className="glass-card fade-in" style={{ textAlign: "center", padding: "60px 32px" }}>
              <div style={{ fontSize: "3rem", marginBottom: 12 }}>🤔</div>
              <h2 style={{ marginBottom: 12 }}>No order found</h2>
              <p style={{ color: "var(--text-dim)", marginBottom: 24 }}>
                You landed here without an order reference. Did you mean to upgrade?
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <Link href="/pricing" className="btn btn-outline">View Pricing</Link>
                <Link href="/transcribe" className="btn btn-primary">Go to App</Link>
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  // 2) Loading
  if (loading) {
    return (
      <>
        <Navbar />
        <main className="app-page">
          <div className="container" style={{ maxWidth: 640 }}>
            <div className="glass-card fade-in" style={{ textAlign: "center", padding: "60px 32px" }}>
              <span className="spinner" style={{ width: 32, height: 32, margin: "0 auto" }} />
              <p style={{ marginTop: 16, color: "var(--text-dim)" }}>
                Confirming your payment...
              </p>
            </div>
          </div>
        </main>
      </>
    );
  }

  // 3) Error / pending state — order not paid yet (e.g. webhook still processing)
  if (error || !order) {
    return (
      <>
        <Navbar />
        <main className="app-page">
          <div className="container" style={{ maxWidth: 640 }}>
            <div className="glass-card fade-in" style={{ textAlign: "center", padding: "60px 32px" }}>
              <div style={{ fontSize: "3rem", marginBottom: 12 }}>⏳</div>
              <h2 style={{ marginBottom: 12 }}>Payment received — confirming</h2>
              <p style={{ color: "var(--text-dim)", marginBottom: 8 }}>
                {error || "We couldn't load your order details right now."}
              </p>
              {paymentId && (
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 20 }}>
                  Payment ID: <code>{paymentId}</code>
                </p>
              )}
              {(fallbackPlan || fallbackCycle) && (
                <p style={{ color: "var(--text-dim)", marginBottom: 20 }}>
                  {fallbackPlan && <>Plan: <strong>{fallbackPlan}</strong> </>}
                  {fallbackCycle && <>({fallbackCycle})</>}
                </p>
              )}
              <p style={{ color: "var(--text-dim)", marginBottom: 24, fontSize: "0.85rem" }}>
                Your access will be activated within a few minutes. You&apos;ll receive a
                confirmation email shortly. If anything looks wrong, contact us with the
                payment ID above.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <button className="btn btn-outline" onClick={() => window.location.reload()}>
                  🔄 Refresh
                </button>
                <Link href="/dashboard" className="btn btn-primary">📊 Go to Dashboard</Link>
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  // 4) Success
  const isPaid = order.status === "paid";
  const amountInr = (order.amount / 100).toLocaleString("en-IN");
  const validDate = order.validUntil
    ? new Date(order.validUntil).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;
  const purchaseDate = new Date(order.createdAt).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
      <Navbar />
      <main className="app-page">
        <div className="container" style={{ maxWidth: 720 }}>
          {/* Hero */}
          <div className="glass-card fade-in" style={{ textAlign: "center", padding: "48px 32px", marginBottom: 24 }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 12 }}>
              {isPaid ? "🎉" : "⏳"}
            </div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 12 }}>
              {isPaid ? (
                <>Welcome to <span className="gradient-text">{order.planName}</span>!</>
              ) : (
                "Payment processing..."
              )}
            </h1>
            <p style={{ color: "var(--text-dim)", fontSize: "1rem", marginBottom: 0 }}>
              {isPaid
                ? `Your ${order.cycle} subscription is now active.`
                : "We've received your payment and are activating your subscription."}
            </p>

            {isPaid && (
              <div style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                <span className="badge badge-success">✅ Payment Captured</span>
                <span className="badge badge-success">✅ Subscription Active</span>
                {order.userEmail && <span className="badge badge-info">📧 Receipt sent to {order.userEmail}</span>}
              </div>
            )}
          </div>

          {/* Receipt details */}
          <div className="glass-card fade-in" style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 20 }}>🧾 Receipt</h3>
            <div className="receipt-grid">
              <ReceiptRow label="Plan" value={`${order.planName} (${order.cycle})`} />
              <ReceiptRow label="Amount paid" value={`₹${amountInr} (incl. GST)`} bold />
              <ReceiptRow label="Order ID" value={order.razorpayOrderId} mono />
              {order.razorpayPaymentId && (
                <ReceiptRow label="Payment ID" value={order.razorpayPaymentId} mono />
              )}
              <ReceiptRow label="Purchase date" value={purchaseDate} />
              {validDate && <ReceiptRow label="Valid until" value={validDate} bold />}
              {order.userName && <ReceiptRow label="Name" value={order.userName} />}
              {order.userEmail && <ReceiptRow label="Email" value={order.userEmail} />}
              <ReceiptRow
                label="Status"
                value={
                  <span className={`badge ${isPaid ? "badge-success" : "badge-warning"}`}>
                    {isPaid ? "✅ Paid" : `⏳ ${order.status}`}
                  </span>
                }
              />
            </div>

            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 16, textAlign: "center" }}>
              Save this page or your email receipt for your records. GST invoice will be
              emailed within 24 hours.
            </p>
          </div>

          {/* Next steps */}
          <div className="glass-card fade-in" style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 16 }}>🚀 What&apos;s next?</h3>
            <div className="next-steps">
              <NextStep
                icon="🎤"
                title="Start using your higher limits"
                desc="Transcribe up to 25 hours / month and unlock advanced TTS"
                href="/transcribe"
                cta="Open Transcribe"
              />
              <NextStep
                icon="📊"
                title="Track your usage"
                desc="See remaining quota, history, and billing in one place"
                href="/dashboard"
                cta="Open Dashboard"
              />
              <NextStep
                icon="💬"
                title="Need help?"
                desc="Priority email & chat support is included on your plan"
                href="/contact"
                cta="Contact Support"
              />
            </div>
          </div>

          {/* Bottom CTA */}
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <Link href="/dashboard" className="btn btn-primary btn-large">
              📊 Go to Dashboard
            </Link>
          </div>
        </div>
      </main>

      {/* Component-scoped styles */}
      <style jsx>{`
        .receipt-grid {
          display: grid;
          gap: 10px;
        }
        .next-steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        @media (max-width: 768px) {
          .next-steps { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function ReceiptRow({
  label,
  value,
  mono,
  bold,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        padding: "10px 14px",
        background: "var(--glass)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
      }}
    >
      <span style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>{label}</span>
      <span
        style={{
          fontFamily: mono ? "ui-monospace, SFMono-Regular, monospace" : undefined,
          fontSize: mono ? "0.8rem" : "0.9rem",
          fontWeight: bold ? 700 : 500,
          textAlign: "right",
          wordBreak: "break-all",
          maxWidth: "60%",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function NextStep({
  icon,
  title,
  desc,
  href,
  cta,
}: {
  icon: string;
  title: string;
  desc: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 18,
        background: "var(--glass)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        textDecoration: "none",
        color: "var(--text)",
        transition: "var(--transition)",
      }}
    >
      <div style={{ fontSize: "1.6rem" }}>{icon}</div>
      <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", flex: 1 }}>{desc}</div>
      <div style={{ fontSize: "0.82rem", color: "var(--accent)", fontWeight: 600 }}>{cta} →</div>
    </Link>
  );
}
