import { NextRequest, NextResponse } from "next/server";
import { tryDbWrite } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/translate
 *
 * Calls MyMemory's free translation API. The Job row (history) is
 * best-effort — a missing or broken DB does NOT block the response.
 *
 * NOTE: A more thorough rewrite of the translation pipeline (sentence-
 * boundary chunking, retry/backoff, real Unicode auto-detect) lives in
 * PR #4. This file deliberately stays close to the old shape so it can
 * be hot-fixed independently to unblock production.
 */

export async function POST(req: NextRequest) {
  let jobId: string | null = null;
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { text, sourceLang, targetLang } = body as {
      text?: unknown;
      sourceLang?: unknown;
      targetLang?: unknown;
    };

    if (typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }
    if (typeof targetLang !== "string" || !targetLang) {
      return NextResponse.json({ error: "Missing targetLang" }, { status: 400 });
    }
    if (text.length > 10000) {
      return NextResponse.json(
        { error: "Text too long. Maximum 10,000 characters." },
        { status: 400 },
      );
    }

    const src = sourceLang === "auto" || !sourceLang ? "en" : String(sourceLang);
    const target = String(targetLang);

    // Best-effort history — never blocks on DB failure.
    const job = await tryDbWrite(
      (db) =>
        db.job.create({
          data: {
            type: "translate",
            title: text.substring(0, 80),
            status: "processing",
            sourceText: text.substring(0, 5000),
            sourceLang: typeof sourceLang === "string" ? sourceLang : "auto",
            targetLang: target,
          },
        }),
      "translate:create-job",
    );
    jobId = job?.id ?? null;

    const langPair = `${src}|${target}`;

    // Note: 4500-char chunks can hit MyMemory's URI/response limits;
    // the proper fix is in PR #4. For this hot-fix we keep the existing
    // chunk size to minimise behavioural change.
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += 4500) {
      chunks.push(text.substring(i, i + 4500));
    }

    const translatedChunks: string[] = [];
    for (const chunk of chunks) {
      const url =
        `https://api.mymemory.translated.net/get` +
        `?q=${encodeURIComponent(chunk)}` +
        `&langpair=${encodeURIComponent(langPair)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.responseStatus === 200 || data.responseStatus === "200") {
        translatedChunks.push(data.responseData?.translatedText ?? "");
      } else {
        throw new Error(data.responseDetails || "Translation service error");
      }
    }

    const translatedText = translatedChunks.join(" ");

    if (jobId) {
      await tryDbWrite(
        (db) =>
          db.job.update({
            where: { id: jobId! },
            data: {
              status: "completed",
              progress: 100,
              translatedText: translatedText.substring(0, 5000),
              engine: "MyMemory (Free)",
            },
          }),
        "translate:complete-job",
      );
    }

    return NextResponse.json({
      originalText: text,
      translatedText,
      sourceLang: typeof sourceLang === "string" ? sourceLang : "auto",
      targetLang: target,
      engine: "MyMemory (Free)",
      historyEnabled: Boolean(jobId),
    });
  } catch (error: unknown) {
    console.error("Translation error:", error);
    const message =
      error instanceof Error ? error.message : "Translation failed";

    if (jobId) {
      await tryDbWrite(
        (db) =>
          db.job.update({
            where: { id: jobId! },
            data: { status: "error", errorMsg: message },
          }),
        "translate:fail-job",
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
