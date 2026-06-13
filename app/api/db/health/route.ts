import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db/prisma";

export const runtime = "nodejs";

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      ok: true,
      database: "reachable",
      timestamp,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        database: "unreachable",
        timestamp,
      },
      { status: 503 }
    );
  }
}
