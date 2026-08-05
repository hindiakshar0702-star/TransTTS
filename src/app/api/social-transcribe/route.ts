import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { guard } from "@/lib/api-guard";
import { getSessionUser } from "@/lib/auth";
import { detectPlatform, downloadVideoFromUrl } from "@/lib/videoDownload";
import { getWhisperClient, transcribeFileForJob } from "@/lib/transcription";
import { translateText } from "@/lib/translate";

export const runtime = "nodejs";

/**
 * POST /api/social-transcribe — non-blocking social-video transcription.
 *
 * Body: { url, language?: "auto"|iso-code, translateToHindi?: boolean }
 * Returns 202 { jobId, platform } immediately; the pipeline
 * (download → Whisper → optional English→Hindi translation) runs in the
 * background and streams progress through the job row, which the client
 * polls via GET /api/jobs/:id.
 *
 * Progress bands: 0–50 download, 50–90 transcription, 90–100 translation.
 */

const BodySchema = z.object({
  url: z.string().trim().url().max(2000),
  language: z.string().trim().max(12).optional().default("auto"),
  translateToHindi: z.boolean().optional().default(false),
});

async function runPipeline(
  jobId: string,
  url: string,
  language: string,
  translateToHindi: boolean
): Promise<void> {
  // 1. Download audio (0–50%).
  const { filePath } = await downloadVideoFromUrl(url, (pct) => {
    void prisma.job
      .update({ where: { id: jobId }, data: { progress: Math.round(pct / 2) } })
      .catch(() => {});
  });

  await prisma.job.update({ where: { id: jobId }, data: { progress: 50 } });

  // 2. Whisper transcription (50–90%). Auto language detection covers
  //    English, Spanish, Chinese, Hindi, Tamil, Telugu, Bengali, Marathi, etc.
  const result = await transcribeFileForJob(jobId, filePath, language);

  // 3. Optional English→Hindi conversion (90–100%). Skipped when the detected
  //    language is already Hindi. Failure is non-fatal: the transcript stands.
  if (translateToHindi && result.text.trim()) {
    const detected = (result.language || "en").toLowerCase().slice(0, 2);
    if (detected !== "hi") {
      await prisma.job.update({ where: { id: jobId }, data: { progress: 92, status: "processing" } });
      const outcome = await translateText(result.text.slice(0, 9000), detected === "auto" ? "en" : detected, "hi");
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: "completed",
          progress: 100,
          translatedText: outcome.ok ? outcome.text.slice(0, 5000) : null,
          sourceLang: detected,
          targetLang: "hi",
          errorMsg: outcome.ok ? null : `Hindi translation unavailable: ${outcome.detail}`,
        },
      });
    }
  }
}

export async function POST(req: NextRequest) {
  // Downloads + Whisper are expensive — keep the cap tight.
  const blocked = guard(req, "social-transcribe", { limit: 5, windowMs: 60_000 });
  if (blocked) return blocked;

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  if (!getWhisperClient()) {
    return NextResponse.json(
      { error: "No API key configured. Add GROQ_API_KEY (free) or OPENAI_API_KEY to .env.local" },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid video URL." }, { status: 400 });
  }
  const { url, language, translateToHindi } = parsed.data;

  // Validate the language parameter against a simple allowlist shape — it is
  // forwarded to the Whisper API.
  if (language !== "auto" && !/^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(language)) {
    return NextResponse.json({ error: "Invalid language code." }, { status: 400 });
  }

  const platform = detectPlatform(url);
  if (!platform) {
    return NextResponse.json(
      { error: "Unsupported URL. Paste a YouTube, Vimeo, X/Twitter, Facebook, Instagram, or Pinterest video link." },
      { status: 400 }
    );
  }

  const job = await prisma.job.create({
    data: {
      userId: sessionUser.id,
      type: "transcribe",
      title: `${platform} video`,
      status: "processing",
      progress: 5,
      fileName: url.slice(0, 250),
      language,
    },
  });

  void runPipeline(job.id, url, language, translateToHindi).catch(async (err) => {
    const raw = err instanceof Error ? err.message : "Processing failed";
    console.error("Social-transcribe error:", err);
    await prisma.job
      .update({ where: { id: job.id }, data: { status: "error", errorMsg: raw } })
      .catch(() => {});
  });

  return NextResponse.json({ jobId: job.id, platform, status: "processing" }, { status: 202 });
}
