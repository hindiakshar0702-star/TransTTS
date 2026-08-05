import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { guard } from "@/lib/api-guard";
import { getSessionUser } from "@/lib/auth";
import { translateText, isValidLangCode } from "@/lib/translate";

export async function POST(req: NextRequest) {
  let jobId: string | null = null;

  const blocked = guard(req, "translate", { limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  try {
    const { text, sourceLang, targetLang } = await req.json();

    if (!text || !targetLang) {
      return NextResponse.json({ error: "Missing text or targetLang" }, { status: 400 });
    }

    if (text.length > 10000) {
      return NextResponse.json({ error: "Text too long. Maximum 10,000 characters." }, { status: 400 });
    }

    // Language codes are concatenated into an outbound URL — restrict them to
    // ISO-639-style tokens so they cannot inject extra query parameters.
    const src = sourceLang === "auto" || !sourceLang ? "en" : String(sourceLang);
    if (!isValidLangCode(src) || !isValidLangCode(String(targetLang))) {
      return NextResponse.json({ error: "Invalid language code." }, { status: 400 });
    }

    // Create job in DB
    const job = await prisma.job.create({
      data: {
        userId: sessionUser.id,
        type: "translate",
        title: text.substring(0, 80),
        status: "processing",
        sourceText: text.substring(0, 2000),
        sourceLang: sourceLang || "auto",
        targetLang,
      },
    });
    jobId = job.id;

    // Shared MyMemory-backed utility (also used by the social-transcribe pipeline).
    const outcome = await translateText(text, src, String(targetLang));
    if (!outcome.ok) {
      // Upstream (MyMemory) reasons — e.g. free-tier quota exhausted — are
      // safe and useful to show the user, unlike internal errors.
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "error", errorMsg: outcome.detail },
      }).catch(() => {});
      return NextResponse.json(
        { error: `Translation failed: ${outcome.detail}` },
        { status: 502 }
      );
    }
    const translatedText = outcome.text;

    // Save to DB
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "completed",
        progress: 100,
        translatedText: translatedText.substring(0, 5000),
        engine: "MyMemory (Free)",
      },
    });

    return NextResponse.json({
      originalText: text,
      translatedText,
      sourceLang: sourceLang || "auto",
      targetLang,
      engine: "MyMemory (Free)",
    });
  } catch (error: unknown) {
    console.error("Translation error:", error);
    const raw = error instanceof Error ? error.message : "";

    if (jobId) {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "error", errorMsg: raw || "Translation failed" },
      }).catch(() => {});
    }

    return NextResponse.json({ error: "Translation failed. Please try again." }, { status: 500 });
  }
}
