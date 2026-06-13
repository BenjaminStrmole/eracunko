import { NextRequest, NextResponse } from "next/server";
import {
  deleteInvoiceDraft,
  getInvoiceDraft,
  saveInvoiceDraft,
} from "../../../../lib/db/invoiceDrafts";
import { getOrCreateCurrentUser } from "../../../../lib/db/userSettings";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function unauthorizedResponse() {
  return NextResponse.json(
    { success: false, message: "Uporabnik ni prijavljen." },
    { status: 401 }
  );
}

function notFoundResponse() {
  return NextResponse.json(
    { success: false, message: "Osnutek ne obstaja." },
    { status: 404 }
  );
}

function serializeDraft(draft: NonNullable<Awaited<ReturnType<typeof getInvoiceDraft>>>) {
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

async function getOwnedDraft(id: string, userId: string) {
  const draft = await getInvoiceDraft(id);
  if (!draft || draft.userId !== userId) return null;
  return draft;
}

export async function GET(request: NextRequest, context: RouteContext) {
  if (!request.cookies.get("bizbox_guid")?.value) {
    return unauthorizedResponse();
  }

  try {
    const user = await getOrCreateCurrentUser();
    const { id } = await context.params;
    const draft = await getOwnedDraft(id, user.id);

    if (!draft) return notFoundResponse();

    return NextResponse.json({
      success: true,
      draft: serializeDraft(draft),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return unauthorizedResponse();
    }

    return NextResponse.json(
      { success: false, message: "Osnutka ni bilo mogoče naložiti." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  if (!request.cookies.get("bizbox_guid")?.value) {
    return unauthorizedResponse();
  }

  try {
    const user = await getOrCreateCurrentUser();
    const { id } = await context.params;
    const existingDraft = await getOwnedDraft(id, user.id);

    if (!existingDraft) return notFoundResponse();

    const body = await request.json();
    const draft = await saveInvoiceDraft({
      id,
      userId: user.id,
      companyId: existingDraft.companyId,
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

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!request.cookies.get("bizbox_guid")?.value) {
    return unauthorizedResponse();
  }

  try {
    const user = await getOrCreateCurrentUser();
    const { id } = await context.params;
    const existingDraft = await getOwnedDraft(id, user.id);

    if (!existingDraft) return notFoundResponse();

    await deleteInvoiceDraft(id);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return unauthorizedResponse();
    }

    return NextResponse.json(
      { success: false, message: "Osnutka ni bilo mogoče izbrisati." },
      { status: 500 }
    );
  }
}
