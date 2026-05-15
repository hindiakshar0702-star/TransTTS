import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { text, sourceLang, targetLang } = await req.json();

    if (!text || !targetLang) {
      return NextResponse.json({ error: "Missing text or targetLang" }, { status: 400 });
    }

    if (text.length > 10000) {
      return NextResponse.json({ error: "Text too long. Maximum 10,000 characters." }, { status: 400 });
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

    // Use FREE MyMemory Translation API
    const src = sourceLang === "auto" ? "en" : sourceLang;
    const langPair = `${src}|${targetLang}`;

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

      if (data.responseStatus === 200) {
        translatedChunks.push(data.responseData.translatedText);
      } else {
        throw new Error(data.responseDetails || "Translation service error");
      }
    }

    const translatedText = translatedChunks.join(" ");

    // Save to DB
    await prisma.job.update({
      where: { id: job.id },
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
    const message = error instanceof Error ? error.message : "Translation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
