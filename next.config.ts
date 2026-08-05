import type { NextConfig } from "next";

// Content-Security-Policy. NOTE: 'unsafe-inline' is required for scripts/styles
// because the app uses inline styles heavily and Next injects inline bootstrap
// scripts. For a strict, nonce-based CSP you need middleware that stamps a
// per-request nonce — see the audit notes. The allow-listed external origin
// (alwingulla.com) is the optional Monetag ad tag; drop it if Monetag is unused.
// Next.js dev/Turbopack uses eval() for HMR and source maps; production never
// does (React never uses eval in prod). So allow 'unsafe-eval' in development
// only and keep the production policy strict.
const isDev = process.env.NODE_ENV !== "production";
// @vercel/analytics loads its script from va.vercel-scripts.com and beacons to
// va.vercel-scripts.com (dev) / same-origin (prod), so it must be allow-listed.
const scriptSrc = [
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://alwingulla.com",
  isDev ? " 'unsafe-eval'" : "",
].join("");

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  scriptSrc,
  "connect-src 'self' https://va.vercel-scripts.com https://vitals.vercel-insights.com https://alwingulla.com",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Force HTTPS for 2 years incl. subdomains (harmless on localhost/HTTP).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Belt-and-suspenders clickjacking defense for old browsers (CSP frame-ancestors covers modern ones).
  { key: "X-Frame-Options", value: "DENY" },
  // Stop MIME sniffing (e.g. treating an uploaded file as HTML/JS).
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // Only the mic is needed (voice recorder); deny the rest.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)" },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  // Emits a self-contained server bundle in .next/standalone, so the runtime
  // Docker stage ships only the traced dependencies instead of node_modules.
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
