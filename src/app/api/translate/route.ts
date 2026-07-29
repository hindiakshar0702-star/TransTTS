import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { guard } from "@/lib/api-guard";

export async function POST(req: NextRequest) {
  let jobId: string | null = null;

  const blocked = guard(req, "translate", { limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;

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
    const LANG_RE = /^[a-z]{2}(-[A-Za-z]{2,4})?$/;
    const src = sourceLang === "auto" || !sourceLang ? "en" : String(sourceLang);
    if (!LANG_RE.test(src) || !LANG_RE.test(String(targetLang))) {
      return NextResponse.json({ error: "Invalid language code." }, { status: 400 });
    }

    // Create job in DB
    const job = await prisma.job.create({
      data: {
        type: "translate",
        title: text.substring(0, 80),
        status: "processing",
        sourceText: text.substring(0, 2000),
        sourceLang: sourceLang || "auto",
        targetLang,
      },
    });
    jobId = job.id;

    // Use FREE MyMemory Translation API (src/targetLang validated above)
    const langPair = encodeURIComponent(`${src}|${targetLang}`);

    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += 4500) {
      chunks.push(text.substring(i, i + 4500));
    }

    const translatedChunks: string[] = [];
    for (const chunk of chunks) {
      const encoded = encodeURIComponent(chunk);
      const url = `https://api.mymemory.translated.net/get?q=${encoded}&langpair=${langPair}`;
      const res = await fetch(url);
      const data = await res.json();

      // MyMemory returns responseStatus as a number OR a string.
      if (Number(data.responseStatus) === 200 && data.responseData?.translatedText) {
        translatedChunks.push(data.responseData.translatedText);
      } else {
        // Upstream (MyMemory) reasons — e.g. free-tier quota exhausted — are
        // safe and useful to show the user, unlike internal errors.
        const detail = typeof data.responseDetails === "string" && data.responseDetails
          ? data.responseDetails
          : "the translation service is temporarily unavailable";
        await prisma.job.update({
          where: { id: jobId },
          data: { status: "error", errorMsg: detail },
        }).catch(() => {});
        return NextResponse.json(
          { error: `Translation failed: ${detail}` },
          { status: 502 }
        );
      }
    }

    const translatedText = translatedChunks.join(" ");

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
