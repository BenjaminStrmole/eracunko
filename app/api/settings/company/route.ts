import { NextResponse } from "next/server";
import {
  getCompanySettings,
  updateCompanySettings,
  type CompanySettingsInput,
} from "../../../../lib/db/companySettings";

export async function GET() {
  try {
    const company = await getCompanySettings();
    return NextResponse.json({ success: true, company });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401 : 500;

    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { company?: CompanySettingsInput };
    const company = await updateCompanySettings(body.company || {});

    return NextResponse.json({ success: true, company });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status =
      message === "UNAUTHENTICATED"
        ? 401
        : message === "COMPANY_TAX_ID_REQUIRED"
          ? 400
          : 500;

    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
