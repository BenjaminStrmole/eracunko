import { NextRequest, NextResponse } from "next/server";
import {
  deleteCustomer,
  serializeCustomer,
  upsertCustomer,
} from "../../../../lib/db/customers";
import { getOrCreateCurrentUser } from "../../../../lib/db/userSettings";

export const runtime = "nodejs";

function unauthorizedResponse() {
  return NextResponse.json(
    { success: false, message: "Uporabnik ni prijavljen." },
    { status: 401 }
  );
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ vatNumber: string }> }
) {
  if (!request.cookies.get("bizbox_guid")?.value) {
    return unauthorizedResponse();
  }

  try {
    const user = await getOrCreateCurrentUser();
    const params = await context.params;
    const body = await request.json();
    const customer = await upsertCustomer(user.id, {
      ...(body?.customer || body),
      vatNumber: decodeURIComponent(params.vatNumber),
    });

    return NextResponse.json({
      success: true,
      customer: serializeCustomer(customer),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return unauthorizedResponse();
    }

    return NextResponse.json(
      { success: false, message: "Stranke ni bilo mogoče posodobiti." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ vatNumber: string }> }
) {
  if (!request.cookies.get("bizbox_guid")?.value) {
    return unauthorizedResponse();
  }

  try {
    const user = await getOrCreateCurrentUser();
    const params = await context.params;
    await deleteCustomer(user.id, decodeURIComponent(params.vatNumber));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return unauthorizedResponse();
    }

    return NextResponse.json(
      { success: false, message: "Stranke ni bilo mogoče izbrisati." },
      { status: 500 }
    );
  }
}
