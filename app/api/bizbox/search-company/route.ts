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

    const params = new URLSearchParams();
    params.set("guid", guid);
    params.set("eLocationId", `C:${cleanVat}`);
    params.set("taxIdFrom", TAX_ID_FROM);
    params.set("dotName", "INVOIC");

    const url = `${BASE_URL}/elocations?${params.toString()}`;

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
        debugUrl: url.replace(guid, "***"),
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
        eLocation: raw?.elocation || `C:${cleanVat}`,
        eAddress: raw?.eaddress || "",
        eAddress1: raw?.eaddress1 || "",
        address: raw?.physicalAddress?.address || "",
        postCode: raw?.physicalAddress?.poCode || "",
        city: raw?.physicalAddress?.po || "",
        country: raw?.physicalAddress?.country || "",
        format: "eSLOG 2.0",
        },
      raw,
      debugUrl: url.replace(guid, "***"),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Napaka pri eImenik klicu.",
      },
      { status: 500 }
    );
  }
}