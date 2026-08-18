import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { translateText, isValidLangCode } from "@/lib/translate";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/translate — public translation via a Groq LLM. No auth, no
 * database: the result is returned in the response and kept client-side.
 */
export async function POST(req: NextRequest) {
  const blocked = guard(req, "translate", { limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;

  try {
    const { text, sourceLang, targetLang } = await req.json();

    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }
    if (typeof targetLang !== "string" || !targetLang) {
      return NextResponse.json({ error: "Missing targetLang" }, { status: 400 });
    }
    if (text.length > 10000) {
      return NextResponse.json({ error: "Text too long. Maximum 10,000 characters." }, { status: 400 });
    }

    // "auto" is passed through rather than coerced to "en": the translator asks
    // the model to detect the source. Coercing it here silently told the model
    // that Hindi (or any other) input was English.
    const src = sourceLang === "auto" || !sourceLang ? "auto" : String(sourceLang);
    if ((src !== "auto" && !isValidLangCode(src)) || !isValidLangCode(String(targetLang))) {
      return NextResponse.json({ error: "Invalid language code." }, { status: 400 });
    }

    const outcome = await translateText(text, src, String(targetLang));
    if (!outcome.ok) {
      return NextResponse.json(
        { error: `Translation failed: ${outcome.detail}` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      originalText: text,
      translatedText: outcome.text,
      sourceLang: sourceLang || "auto",
      targetLang,
      engine: "Groq (Free)",
    });
  } catch (error: unknown) {
    console.error("Translation error:", error);
    return NextResponse.json({ error: "Translation failed. Please try again." }, { status: 500 });
  }
}
