import { NextRequest, NextResponse } from "next/server";
import {
  listCustomers,
  serializeCustomer,
  upsertCustomer,
} from "../../../lib/db/customers";
import { getOrCreateCurrentUser } from "../../../lib/db/userSettings";

export const runtime = "nodejs";

function unauthorizedResponse() {
  return NextResponse.json(
    { success: false, message: "Uporabnik ni prijavljen." },
    { status: 401 }
  );
}

export async function GET(request: NextRequest) {
  if (!request.cookies.get("bizbox_guid")?.value) {
    return unauthorizedResponse();
  }

  try {
    const user = await getOrCreateCurrentUser();
    const customers = await listCustomers(user.id);

    return NextResponse.json({
      success: true,
      customers: customers.map(serializeCustomer),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return unauthorizedResponse();
    }

    return NextResponse.json(
      { success: false, message: "Strank ni bilo mogoče naložiti." },
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
    const customer = await upsertCustomer(user.id, body?.customer || body);

    return NextResponse.json({
      success: true,
      customer: serializeCustomer(customer),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return unauthorizedResponse();
    }

    const status =
      error instanceof Error && error.message === "CUSTOMER_VAT_REQUIRED"
        ? 400
        : 500;

    return NextResponse.json(
      { success: false, message: "Stranke ni bilo mogoče shraniti." },
      { status }
    );
  }
}
