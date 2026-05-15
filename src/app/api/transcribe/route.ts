import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import prisma from "@/lib/prisma";
import { generateId } from "@/lib/utils";
import { getUploadsDir } from "@/lib/server-utils";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

function getClient() {
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (groqKey && groqKey !== "your-groq-api-key-here") {
    return {
      client: new OpenAI({ apiKey: groqKey, baseURL: "https://api.groq.com/openai/v1" }),
      model: "whisper-large-v3-turbo",
      engine: "groq",
    };
  }
  if (openaiKey && openaiKey !== "sk-your-api-key-here") {
    return {
      client: new OpenAI({ apiKey: openaiKey }),
      model: "whisper-1",
      engine: "openai",
    };
  }
  return null;
}

export async function POST(req: NextRequest) {
  let jobId: string | null = null;
  try {
    const config = getClient();
    if (!config) {
      return NextResponse.json(
        { error: "No API key configured. Add GROQ_API_KEY (free) or OPENAI_API_KEY to .env.local" },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const language = (formData.get("language") as string) || "auto";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum 25MB." }, { status: 400 });
    }

    // Create job in DB
    const job = await prisma.job.create({
      data: {
        type: "transcribe",
        title: file.name,
        status: "processing",
        progress: 10,
        fileName: file.name,
        fileSize: file.size,
        language: language,
      },
    });
    jobId = job.id;

    // Save file
    const uploadsDir = getUploadsDir();
    const fileId = generateId();
    const ext = path.extname(file.name) || ".mp3";
    const filePath = path.join(uploadsDir, `${fileId}${ext}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // Update progress
    await prisma.job.update({ where: { id: jobId }, data: { progress: 30 } });

    // Transcribe with Whisper
    const transcription = await config.client.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: config.model,
      language: language !== "auto" ? language : undefined,
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });

    const segments = (transcription.segments || []).map((seg, idx: number) => ({
      id: idx,
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
    }));

    // Clean up file
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }

    // Save result to DB
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "completed",
        progress: 100,
        language: transcription.language || language,
        duration: transcription.duration || 0,
        transcript: transcription.text,
        segments: JSON.stringify(segments),
      },
    });

    return NextResponse.json({
      id: jobId,
      text: transcription.text,
      language: transcription.language || language,
      duration: transcription.duration || 0,
      segments,
      engine: config.engine,
    });
  } catch (error: unknown) {
    console.error("Transcription error:", error);
    let message = error instanceof Error ? error.message : "Transcription failed";

    if (message.includes("429") || message.includes("quota") || message.includes("billing")) {
      message = "API quota exceeded. Get a FREE Groq key at console.groq.com";
    }

    // Update job as failed
    if (jobId) {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "error", errorMsg: message },
      }).catch(() => {});
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
