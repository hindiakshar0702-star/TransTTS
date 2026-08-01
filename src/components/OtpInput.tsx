"use client";
import { useRef, type KeyboardEvent, type ClipboardEvent } from "react";

/**
 * 6-box OTP input. Controlled via `value` (the full string) + `onChange`.
 * Auto-advances on entry, backspaces to the previous box, and accepts a pasted
 * 6-digit code. Digits only.
 */
export default function OtpInput({
  value,
  onChange,
  disabled,
  length = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  length?: number;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const setChar = (i: number, ch: string) => {
    const chars = value.split("");
    chars[i] = ch;
    // Pad so indices stay aligned, then trim trailing gaps.
    const next = Array.from({ length }, (_, k) => chars[k] ?? "").join("").replace(/\s/g, "");
    onChange(next.slice(0, length));
  };

  const handleInput = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    if (!digit) return;
    setChar(i, digit);
    if (i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (value[i]) {
        setChar(i, "");
      } else if (i > 0) {
        refs.current[i - 1]?.focus();
        setChar(i - 1, "");
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < length - 1) {
      refs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!digits) return;
    onChange(digits);
    refs.current[Math.min(digits.length, length - 1)]?.focus();
  };

  return (
    <div style={{ display: "flex", gap: "8px", justifyContent: "space-between" }} role="group" aria-label="One-time code">
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={value[i] ?? ""}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => handleInput(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className="text-input"
          style={{
            width: "48px",
            height: "56px",
            textAlign: "center",
            fontSize: "1.4rem",
            fontWeight: 700,
            padding: 0,
          }}
        />
      ))}
    </div>
  );
}
