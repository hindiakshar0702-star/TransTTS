import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const generatedDir = path.join(process.cwd(), "generated");
    const filePath = path.join(generatedDir, `${id}.mp3`);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Audio not found" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);

    // Check if download is requested via query param
    const download = req.nextUrl.searchParams.get("download") === "1";

    const headers: Record<string, string> = {
      "Content-Type": "audio/mpeg",
      "Content-Length": fileBuffer.length.toString(),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=86400",
    };

    if (download) {
      headers["Content-Disposition"] = `attachment; filename="speech-${id}.mp3"`;
    } else {
      headers["Content-Disposition"] = "inline";
    }

    return new NextResponse(fileBuffer, { headers });
  } catch (error: unknown) {
    console.error("Audio serve error:", error);
    return NextResponse.json({ error: "Failed to serve audio" }, { status: 500 });
  }
}
