import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.BIZBOX_BASE_URL;
const TAX_ID_FROM = process.env.BIZBOX_TAX_ID_FROM;

const SUPPORTED_COUNTRY_PREFIXES = [
  "SI",
  "HR",
  "RS",
  "BA",
  "BIH",
  "BE",
  "IT",
  "DE",
  "AT",
  "HU",
  "FR",
  "NL",
  "CZ",
  "SK",
  "PL",
];

function normalizeVatNumber(value: string) {
  const cleaned = value.trim().toUpperCase().replace(/\s+/g, "");

  if (cleaned.startsWith("BIH")) {
    return `BA${cleaned.slice(3)}`;
  }

  return cleaned;
}

function validateVatNumber(value: string) {
  const cleaned = normalizeVatNumber(value);

  if (!cleaned) {
    return {
      valid: false,
      value: cleaned,
      message: "Manjka davčna številka.",
    };
  }

  const matchedPrefix = SUPPORTED_COUNTRY_PREFIXES.find((prefix) =>
    cleaned.startsWith(prefix)
  );

  if (!matchedPrefix) {
    return {
      valid: false,
      value: cleaned,
      message:
        "Davčna številka mora vsebovati oznako države, npr. SI66666666, HR12345678901, BE0123456789, RS123456789, BA123456789, IT12345678901.",
    };
  }

  const numberPart = cleaned.slice(matchedPrefix.length);

  if (numberPart.length < 2 || !/^[A-Z0-9]+$/.test(numberPart)) {
    return {
      valid: false,
      value: cleaned,
      message:
        "Davčna številka ni v pravilni obliki. Začni z oznako države in nato vpiši številko.",
    };
  }

  return {
    valid: true,
    value: cleaned,
    message: "",
  };
}

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

function detectNetwork(raw: any) {
  const eaddress = String(raw?.eaddress || "").toUpperCase();
  const eaddress1 = String(raw?.eaddress1 || "").toUpperCase();
  const elocation = String(raw?.elocation || "").toUpperCase();
  const combined = `${eaddress} ${eaddress1} ${elocation}`;

  if (combined.includes("UJP")) {
    return {
      network: "UJP",
      receiverChannel: "Prejem prek UJP",
    };
  }

  if (combined.includes("SEF")) {
    return {
      network: "SEF",
      receiverChannel: "Prejem prek srbskega SEF",
    };
  }

  if (combined.includes("BANK") || combined.includes("BANKA")) {
    return {
      network: "Banka",
      receiverChannel: "Prejem prek banke",
    };
  }

  if (combined.includes("BIZBOX")) {
    return {
      network: "bizBox",
      receiverChannel: "Prejem prek bizBox omrežja",
    };
  }

  return {
    network: "Neznano",
    receiverChannel: "Kanal prejema ni razpoznan",
  };
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

    const validation = validateVatNumber(vatNumber);

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          status: "INVALID_INPUT",
          message: validation.message,
        },
        { status: 400 }
      );
    }

    const cleanVat = validation.value;

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
if (!text || !text.trim()) {
  return NextResponse.json({
    success: false,
    status: "NOT_READY",
    message:
      "API ni vrnil podatkov o prejemniku. Prejemnik morda obstaja v javnem eImeniku, vendar ta klic ne vrača podrobnosti.",
    raw,
    debugUrl: url.replace(guid, "***"),
  });
}

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
      raw?.physicalAddress?.name ||
      getValue(raw, [
        "name",
        "Name",
        "naziv",
        "Naziv",
        "companyName",
        "CompanyName",
        "partnerName",
      ]) ||
      cleanVat;

    const networkInfo = detectNetwork(raw);

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
        network: networkInfo.network,
        receiverChannel: networkInfo.receiverChannel,
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