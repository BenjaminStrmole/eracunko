import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE_URL = process.env.BIZBOX_BASE_URL;
const TAX_ID_FROM = process.env.BIZBOX_TAX_ID_FROM;

function formatDate(value: any) {
  if (!value) return "-";

  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("sl-SI", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function normalizeDocument(item: any, index: number) {
  return {
    id: String(item.id || item.docid || item.docId || index),
    number: item.externalid || item.title || item.filename || `Dokument ${index + 1}`,
    sender: item.organization || item.creationlocation || "-",
    type: item.type || item.classificationname || "Dokument",
    status: item.status || "Prejet",
    date: formatDate(item.creationtime || item.insertdate),
    raw: item,
  };
}

function normalizeResponse(raw: any) {
  if (Array.isArray(raw?.document)) {
    return raw.document.map(normalizeDocument);
  }

  if (Array.isArray(raw?.documents)) {
    return raw.documents.map(normalizeDocument);
  }

  if (Array.isArray(raw)) {
    return raw.map(normalizeDocument);
  }

  return [];
}

export async function GET(request: NextRequest) {
  try {
    if (!BASE_URL || !TAX_ID_FROM) {
      return NextResponse.json(
        { success: false, message: "Manjka BIZBOX_BASE_URL ali BIZBOX_TAX_ID_FROM." },
        { status: 500 }
      );
    }

    const guid = request.cookies.get("bizbox_guid")?.value;

    if (!guid) {
      return NextResponse.json(
        { success: false, message: "Uporabnik ni prijavljen v bizBox." },
        { status: 401 }
      );
    }

    const params = new URLSearchParams();
    params.set("guid", guid);
    params.set("taxNumber", TAX_ID_FROM);

    const url = `${BASE_URL}/documents/list?${params.toString()}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json, text/plain, */*",
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({}),
      cache: "no-store",
    });

    if (response.status === 204) {
      return NextResponse.json({
        success: true,
        documents: [],
        raw: null,
      });
    }

    const text = await response.text();

    let raw: any = text;

    try {
      raw = JSON.parse(text);
    } catch {}

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: "Pridobivanje dokumentov iz bizBox ni uspelo.",
          raw,
          debugUrl: url.replace(guid, "***"),
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      documents: normalizeResponse(raw),
      raw,
      debugUrl: url.replace(guid, "***"),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Napaka pri pridobivanju inbox dokumentov.",
      },
      { status: 500 }
    );
  }
}