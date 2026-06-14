import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [
      users,
      userSettings,
      companies,
      invoiceDrafts,
      localSentInvoices,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.userSettings.count(),
      prisma.company.count(),
      prisma.invoiceDraft.count(),
      prisma.localSentInvoice.count(),
    ]);

    return NextResponse.json({
      ok: true,
      counts: {
        users,
        userSettings,
        companies,
        invoiceDrafts,
        localSentInvoices,
      },
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        counts: null,
      },
      { status: 503 }
    );
  }
}
