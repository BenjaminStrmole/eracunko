import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.BIZBOX_BASE_URL;
const TAX_ID_FROM = process.env.BIZBOX_TAX_ID_FROM;

function getValue(data: any, keys: string[]): string | null {
  if (!data || typeof data !== "object") return null;

  for (const key of keys) {
    if (typeof data[key] === "string") return data[key];
  }

  for (const value of Object.values(data)) {
    const found = getValue(value, keys);
    if (found) return found;
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    if (!BASE_URL || !TAX_ID_FROM) {
      return NextResponse.json(
        { success: false, message: "Manjkajo backend nastavitve." },
        { status: 500 }
      );
    }

    const guid = request.cookies.get("bizbox_guid")?.value;

    if (!guid) {
      return NextResponse.json(
        { success: false, message: "Uporabnik ni prijavljen." },
        { status: 401 }
      );
    }

    const vatNumber = request.nextUrl.searchParams.get("vatNumber");

    if (!vatNumber) {
      return NextResponse.json(
        { success: false, message: "Manjka davčna številka." },
        { status: 400 }
      );
    }

    const cleanVat = vatNumber.trim().toUpperCase();

    const url =
      `${BASE_URL}/elocations/ext?` +
      new URLSearchParams({
        guid,
        eLocationId: `C:${cleanVat}`,
        taxIdFrom: TAX_ID_FROM,
        dotName: "INVOIC",
        dofName: "ESLOG.2_0",
      });

    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    const text = await response.text();

    let raw: any = text;

    try {
      raw = JSON.parse(text);
    } catch {}

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        status: "NOT_READY",
        message: "Podjetje ni najdeno ali ne prejema e-računov.",
        raw,
      });
    }

    const name =
      getValue(raw, [
        "name",
        "Name",
        "naziv",
        "Naziv",
        "companyName",
        "CompanyName",
        "partnerName",
      ]) || cleanVat;

    return NextResponse.json({
      success: true,
      status: "READY",
      customer: {
        name,
        vatNumber: cleanVat,
        status: "READY",
        eLocation: `C:${cleanVat}`,
        format: "eSLOG 2.0",
      },
      raw,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Napaka pri eImenik klicu." },
      { status: 500 }
    );
  }
}