import { NextRequest, NextResponse } from "next/server";
import {
  listInvoiceDrafts,
  saveInvoiceDraft,
} from "../../../lib/db/invoiceDrafts";
import { getOrCreateCurrentUser } from "../../../lib/db/userSettings";

export const runtime = "nodejs";

function unauthorizedResponse() {
  return NextResponse.json(
    { success: false, message: "Uporabnik ni prijavljen." },
    { status: 401 }
  );
}

function serializeDraft(draft: Awaited<ReturnType<typeof listInvoiceDrafts>>[number]) {
  const data =
    typeof draft.data === "object" && draft.data !== null && !Array.isArray(draft.data)
      ? draft.data
      : {};

  return {
    ...data,
    dbId: draft.id,
    id: (data as { id?: unknown }).id || draft.id,
    number: (data as { number?: unknown }).number || draft.documentNumber || "",
    profile: (data as { profile?: unknown }).profile || draft.profile || "",
    buyer:
      (data as { buyer?: unknown }).buyer || {
        name: draft.buyerName || "",
        vat: draft.buyerVat || "",
      },
    totals:
      (data as { totals?: unknown }).totals || {
        gross: draft.grossAmount ? Number(draft.grossAmount) : 0,
      },
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
    status: "DRAFT",
  };
}

export async function GET(request: NextRequest) {
  if (!request.cookies.get("bizbox_guid")?.value) {
    return unauthorizedResponse();
  }

  try {
    const user = await getOrCreateCurrentUser();
    const companyId = request.nextUrl.searchParams.get("companyId") || undefined;
    const drafts = await listInvoiceDrafts(user.id, companyId);

    return NextResponse.json({
      success: true,
      drafts: drafts.map(serializeDraft),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return unauthorizedResponse();
    }

    return NextResponse.json(
      { success: false, message: "Osnutkov ni bilo mogoče naložiti." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!request.cookies.get("bizbox_guid")?.value) {
    return unauthorizedResponse();
  }

  try {
    const user = await getOrCreateCurrentUser();
    const body = await request.json();
    const draft = await saveInvoiceDraft({
      userId: user.id,
      companyId: typeof body?.companyId === "string" ? body.companyId : undefined,
      data: body?.draft || body,
    });

    return NextResponse.json({
      success: true,
      draft: serializeDraft(draft),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return unauthorizedResponse();
    }

    return NextResponse.json(
      { success: false, message: "Osnutka ni bilo mogoče shraniti." },
      { status: 500 }
    );
  }
}
