import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import prisma from "@/lib/prisma";
import { generateId } from "@/lib/utils";
import { getGeneratedDir } from "@/lib/server-utils";
import fs from "fs";
import path from "path";

const VOICES: Record<string, string> = {
  "hi-female": "hi-IN-SwaraNeural",
  "hi-male": "hi-IN-MadhurNeural",
  "en-female": "en-US-JennyNeural",
  "en-male": "en-US-GuyNeural",
  "en-uk-female": "en-GB-SoniaNeural",
  "en-uk-male": "en-GB-RyanNeural",
  "es-female": "es-ES-ElviraNeural",
  "fr-female": "fr-FR-DeniseNeural",
  "de-female": "de-DE-KatjaNeural",
  "ja-female": "ja-JP-NanamiNeural",
  "ko-female": "ko-KR-SunHiNeural",
  "ar-male": "ar-SA-HamedNeural",
  "pt-female": "pt-BR-FranciscaNeural",
  "bn-female": "bn-IN-TanishaaNeural",
  "ta-female": "ta-IN-PallaviNeural",
  "te-female": "te-IN-ShrutiNeural",
  "mr-female": "mr-IN-AarohiNeural",
  "gu-female": "gu-IN-DhwaniNeural",
  "ur-male": "ur-PK-AsadNeural",
};

export async function POST(req: NextRequest) {
  try {
    const { text, voice } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    if (text.length > 5000) {
      return NextResponse.json({ error: "Text too long. Maximum 5000 characters." }, { status: 400 });
    }

    const msVoice = VOICES[voice] || VOICES["hi-female"];

    // Create job in DB
    const job = await prisma.job.create({
      data: {
        type: "tts",
        title: text.substring(0, 80),
        status: "processing",
        text: text.substring(0, 2000),
        voice: msVoice,
      },
    });

    const generatedDir = getGeneratedDir();
    const fileId = generateId();
    const tempDir = path.join(generatedDir, fileId);
    fs.mkdirSync(tempDir, { recursive: true });

    const tts = new MsEdgeTTS();
    await tts.setMetadata(msVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    await tts.toFile(tempDir, text);

    const generatedFile = path.join(tempDir, "audio.mp3");
    const finalPath = path.join(generatedDir, `${fileId}.mp3`);

    if (fs.existsSync(generatedFile)) {
      fs.renameSync(generatedFile, finalPath);
      try { fs.rmdirSync(tempDir); } catch { /* ignore */ }
    } else {
      throw new Error("Audio file was not generated");
    }

    const audioUrl = `/api/tts/audio/${fileId}`;

    // Save to DB
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "completed", progress: 100, audioUrl },
    });

    return NextResponse.json({
      id: fileId,
      audioUrl,
      voice: msVoice,
      textLength: text.length,
    });
  } catch (error: unknown) {
    console.error("TTS error:", error);
    const message = error instanceof Error ? error.message : "TTS generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
