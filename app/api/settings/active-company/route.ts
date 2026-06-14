import { NextRequest, NextResponse } from "next/server";
import {
  getActiveCompany,
  updateActiveCompany,
  type StoredActiveCompany,
} from "../../../../lib/db/userSettings";

export const runtime = "nodejs";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeActiveCompany(value: unknown): StoredActiveCompany | null {
  if (value === null) return null;
  if (!isObject(value)) return null;

  return {
    name: typeof value.name === "string" ? value.name : "",
    taxId: typeof value.taxId === "string" ? value.taxId : "",
    vatNumber: typeof value.vatNumber === "string" ? value.vatNumber : "",
    locationName:
      typeof value.locationName === "string" ? value.locationName : "",
    locationId: typeof value.locationId === "string" ? value.locationId : "",
    eLocation: typeof value.eLocation === "string" ? value.eLocation : "",
    eAddress: typeof value.eAddress === "string" ? value.eAddress : "",
    address: typeof value.address === "string" ? value.address : "",
    street: typeof value.street === "string" ? value.street : "",
    postCode: typeof value.postCode === "string" ? value.postCode : "",
    city: typeof value.city === "string" ? value.city : "",
    country: typeof value.country === "string" ? value.country : "",
    registrationNumber:
      typeof value.registrationNumber === "string"
        ? value.registrationNumber
        : "",
    iban: typeof value.iban === "string" ? value.iban : "",
    bic: typeof value.bic === "string" ? value.bic : "",
    contactName:
      typeof value.contactName === "string" ? value.contactName : "",
    contactEmail:
      typeof value.contactEmail === "string" ? value.contactEmail : "",
    contactPhone:
      typeof value.contactPhone === "string" ? value.contactPhone : "",
    canSendInvoices:
      typeof value.canSendInvoices === "boolean"
        ? value.canSendInvoices
        : undefined,
  };
}

function unauthorizedResponse() {
  return NextResponse.json(
    { success: false, message: "Uporabnik ni prijavljen." },
    { status: 401 }
  );
}

function errorResponse() {
  return NextResponse.json(
    { success: false, message: "Nastavitev aktivnega podjetja ni uspela." },
    { status: 500 }
  );
}

function devLog(message: string, meta?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") return;
  console.info(`[api/settings/active-company] ${message}`, meta || {});
}

export async function GET(request: NextRequest) {
  devLog("GET called");

  if (!request.cookies.get("bizbox_guid")?.value) {
    devLog("GET unauthorized: missing bizbox_guid");
    return unauthorizedResponse();
  }

  try {
    const activeCompany = await getActiveCompany();
    devLog("GET active company loaded", {
      hasActiveCompany: Boolean(activeCompany),
    });

    return NextResponse.json({
      success: true,
      activeCompany,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return unauthorizedResponse();
    }

    return errorResponse();
  }
}

export async function PUT(request: NextRequest) {
  devLog("PUT called");

  if (!request.cookies.get("bizbox_guid")?.value) {
    devLog("PUT unauthorized: missing bizbox_guid");
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const activeCompany = sanitizeActiveCompany(body?.activeCompany ?? null);
    devLog("PUT payload parsed", {
      hasActiveCompany: Boolean(activeCompany),
      activeCompanyTaxId: activeCompany?.taxId || activeCompany?.vatNumber || null,
    });

    if (body?.activeCompany && !activeCompany?.name && !activeCompany?.taxId) {
      return NextResponse.json(
        { success: false, message: "Manjkajo podatki podjetja." },
        { status: 400 }
      );
    }

    await updateActiveCompany(activeCompany);
    devLog("PUT active company saved");

    return NextResponse.json({
      success: true,
      activeCompany,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return unauthorizedResponse();
    }

    return errorResponse();
  }
}
