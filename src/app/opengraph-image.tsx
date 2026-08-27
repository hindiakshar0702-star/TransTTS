import { ImageResponse } from "next/og";

/**
 * Social preview card, generated at request time instead of shipping a binary.
 * Next wires the og:image / twitter:image tags automatically for every route
 * that does not define its own, so link previews stay on-brand without anyone
 * having to maintain a 1200x630 PNG by hand.
 */

export const alt = "TransTTS — Free AI Text to Speech & Voice Generator";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0a0a0a",
          backgroundImage:
            "radial-gradient(circle at 85% 15%, rgba(255,128,0,0.28), transparent 55%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand mark: orange badge + wordmark */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 48 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "#FF8000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 24,
              fontSize: 44,
              fontWeight: 800,
              color: "#0a0a0a",
            }}
          >
            t
          </div>
          <div style={{ display: "flex", fontSize: 48, fontWeight: 800, color: "#ffffff" }}>
            <span>Trans</span>
            <span style={{ color: "#FF8000" }}>TTS</span>
          </div>
        </div>

        <div
          style={{
            fontSize: 68,
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            maxWidth: 900,
          }}
        >
          Free AI Text to Speech & Voice Generator
        </div>

        <div style={{ fontSize: 30, color: "#a8a8a3", marginTop: 28, maxWidth: 860, lineHeight: 1.4 }}>
          Natural Hindi, English and multilingual AI voices online — plus Whisper
          transcription and translation.
        </div>

        <div style={{ display: "flex", marginTop: 52 }}>
          {["Record", "Transcribe", "Translate", "Voice"].map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                fontSize: 22,
                color: "#e8e8e3",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 999,
                padding: "10px 24px",
                marginRight: 14,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
