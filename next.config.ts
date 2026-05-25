import type { NextConfig } from "next";

/**
 * Production security headers (BUG-021).
 *
 * The previous config was empty, leaving the app to whatever defaults
 * Vercel's edge applied. We now ship an explicit, conservative set:
 *
 *   - X-Content-Type-Options: nosniff
 *       Stops the browser from MIME-sniffing audio/json responses
 *       into something executable.
 *
 *   - Referrer-Policy: strict-origin-when-cross-origin
 *       Strips path + query when requests cross origins (so we
 *       don't leak `/upgrade?paymentId=...` to third parties).
 *
 *   - X-Frame-Options: DENY
 *       Belt-and-braces with the CSP frame-ancestors directive —
 *       prevents the app being embedded in someone else's <iframe>
 *       to phish credentials.
 *
 *   - Strict-Transport-Security: 2-year max-age, includeSubDomains
 *       Vercel already serves the app over TLS only; HSTS pins
 *       browsers to that even if a user types `http://`.
 *
 *   - Permissions-Policy
 *       Pre-emptively disables hardware features the app doesn't
 *       need (camera, geolocation, payment, USB, etc.).
 *
 *   - Content-Security-Policy
 *       Whitelist of script / connect / img sources. Razorpay's
 *       checkout.js loads from checkout.razorpay.com so it has
 *       to be allowed there. We use 'unsafe-inline' for scripts
 *       only because Next.js's bundle uses inline runtime hooks;
 *       a future migration to nonce-based CSP is tracked separately.
 *
 * If any third-party SDK fails to load after deploy, check the
 * browser console for a 'Refused to load' message and add the
 * domain to the matching directive below.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=(self)", // /transcribe needs mic for live recording
      "geolocation=()",
      "payment=(self)",
      "usb=()",
      "interest-cohort=()",
    ].join(", "),
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Razorpay checkout SDK + Vercel Analytics + Speed Insights
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://va.vercel-scripts.com https://vercel.live",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: data:",
      // XHR / fetch — Razorpay APIs, MyMemory, OpenAI/Groq, PhonePe redirect
      "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://api.mymemory.translated.net https://api.groq.com https://api.openai.com https://api.phonepe.com https://api-preprod.phonepe.com https://va.vercel-scripts.com https://vercel.live wss:",
      // Razorpay checkout opens its modal as an iframe
      "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://api.phonepe.com https://api-preprod.phonepe.com",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply to every route. Static assets get the same headers,
        // which is harmless and saves an extra rule.
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
