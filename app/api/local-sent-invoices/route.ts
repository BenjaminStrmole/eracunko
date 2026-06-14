import { NextRequest, NextResponse } from "next/server";
import {
  saveLocalSentInvoice,
  serializeLocalSentInvoice,
} from "../../../lib/db/localSentInvoices";
import { getOrCreateCurrentUser } from "../../../lib/db/userSettings";

export const runtime = "nodejs";

function unauthorizedResponse() {
  return NextResponse.json(
    { success: false, message: "Uporabnik ni prijavljen." },
    { status: 401 }
  );
}

export async function POST(request: NextRequest) {
  if (!request.cookies.get("bizbox_guid")?.value) {
    return unauthorizedResponse();
  }

  try {
    const user = await getOrCreateCurrentUser();
    const body = await request.json();
    const sentInvoice = await saveLocalSentInvoice(user.id, body?.invoice || body);

    return NextResponse.json({
      success: true,
      invoice: serializeLocalSentInvoice(sentInvoice),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return unauthorizedResponse();
    }

    return NextResponse.json(
      { success: false, message: "Poslanega računa ni bilo mogoče shraniti v bazo." },
      { status: 500 }
    );
  }
}
