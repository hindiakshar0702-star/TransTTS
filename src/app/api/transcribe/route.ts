import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateId } from "@/lib/utils";
import { getUploadsDir } from "@/lib/server-utils";
import { guard } from "@/lib/api-guard";
import { getSessionUser } from "@/lib/auth";
import {
  looksLikeMedia,
  getWhisperClient,
  safeTranscribeError,
  transcribeFileForJob,
} from "@/lib/transcription";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

/**
 * Non-blocking upload: the POST validates the file, writes it to disk, creates
 * the job row, kicks off Whisper in the background, and returns the jobId
 * immediately. The client polls GET /api/jobs/:id for progress/result, so the
 * UI never sits inside one long blocking request.
 */
export async function POST(req: NextRequest) {
  // Abuse control: transcription hits a paid Whisper API — cap it hard.
  const blocked = guard(req, "transcribe", { limit: 10, windowMs: 60_000 });
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

  let jobId: string | null = null;
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const language = (formData.get("language") as string) || "auto";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum 25MB." }, { status: 400 });
    }

    // Validate real file type by magic number — never trust extension/Content-Type.
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    if (!looksLikeMedia(fileBuffer)) {
      return NextResponse.json(
        { error: "Unsupported file. Upload a real audio or video file (MP3, WAV, MP4, MKV, OGG, FLAC, WebM)." },
        { status: 415 }
      );
    }

    // Save file (async — never block the event loop on disk I/O).
    const uploadsDir = getUploadsDir();
    const fileId = generateId();
    let ext = path.extname(file.name) || ".mp3";
    // Sanitize extension to prevent any injection/traversal
    ext = ext.replace(/[^a-zA-Z0-9.]/g, "");
    if (!ext.startsWith(".")) ext = "." + ext;

    const filePath = path.normalize(path.join(uploadsDir, `${fileId}${ext}`));
    // Verify path traversal defense-in-depth
    if (!filePath.startsWith(uploadsDir)) {
      return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
    }
    await fs.promises.writeFile(filePath, fileBuffer);

    const job = await prisma.job.create({
      data: {
        userId: sessionUser.id,
        type: "transcribe",
        title: file.name,
        status: "processing",
        progress: 20,
        fileName: file.name,
        fileSize: file.size,
        language,
      },
    });
    jobId = job.id;

    // Fire-and-forget background processing; the job row carries the outcome.
    void transcribeFileForJob(job.id, filePath, language).catch(async (err) => {
      const raw = err instanceof Error ? err.message : "";
      console.error("Transcription error:", err);
      await prisma.job.update({
        where: { id: job.id },
        data: { status: "error", errorMsg: raw || "Transcription failed" },
      }).catch(() => {});
    });

    // 202 Accepted: processing continues in the background.
    return NextResponse.json({ jobId: job.id, status: "processing" }, { status: 202 });
  } catch (error: unknown) {
    console.error("Transcription intake error:", error);
    const raw = error instanceof Error ? error.message : "";
    if (jobId) {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "error", errorMsg: raw || "Upload failed" },
      }).catch(() => {});
    }
    return NextResponse.json({ error: safeTranscribeError(raw) }, { status: 500 });
  }
}
