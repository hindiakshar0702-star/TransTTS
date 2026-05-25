import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

/** Match Prisma's @default(uuid()) — RFC 4122 v1-v5 ids. */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateId(id: string | undefined): string | null {
  if (!id || typeof id !== "string") return null;
  if (!UUID_REGEX.test(id)) return null;
  return id;
}

/* -------------------------------------------------------------------- */
/* GET /api/jobs/[id] — fetch a single job                               */
/* -------------------------------------------------------------------- */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = validateId(rawId);
    if (!id) {
      return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
    }

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json(job);
  } catch (error: unknown) {
    console.error("Get job error:", error);
    return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 });
  }
}

/* -------------------------------------------------------------------- */
/* DELETE /api/jobs/[id] — delete a single job (operator-only)          */
/* -------------------------------------------------------------------- */

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const { id: rawId } = await params;
    const id = validateId(rawId);
    if (!id) {
      return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
    }

    await prisma.job.delete({ where: { id } });
    return NextResponse.json({ message: "Job deleted" });
  } catch (error: unknown) {
    // Prisma throws P2025 when the row is missing. Treat that as 404.
    const code = (error as { code?: string })?.code;
    if (code === "P2025") {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    console.error("Delete job error:", error);
    return NextResponse.json({ error: "Failed to delete job" }, { status: 500 });
  }
}
