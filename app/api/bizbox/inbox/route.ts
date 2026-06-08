import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE_URL = process.env.BIZBOX_BASE_URL;

function normalizeDocument(item: any, index: number) {
  return {
    id:
      item.id ||
      item.docId ||
      item.documentId ||
      item.envelopeId ||
      item.external_id ||
      String(index),
    number:
      item.external_id ||
      item.externalId ||
      item.number ||
      item.subject ||
      item.fileName ||
      item.file_name ||
      `Dokument ${index + 1}`,
    sender:
      item.from?.name ||
      item.sender?.name ||
      item.fromName ||
      item.senderName ||
      item.from ||
      "-",
    type:
      item.type ||
      item.documentType ||
      item.docType ||
      item.format ||
      "Dokument",
    status:
      item.status ||
      item.state ||
      item.documentStatus ||
      "Prejet",
    date:
      item.date ||
      item.created ||
      item.createdAt ||
      item.timestamp ||
      item.receivedAt ||
      "-",
    raw: item,
  };
}

function normalizeResponse(raw: any) {
  if (Array.isArray(raw)) {
    return raw.map(normalizeDocument);
  }

  if (Array.isArray(raw?.documents)) {
    return raw.documents.map(normalizeDocument);
  }

  if (Array.isArray(raw?.items)) {
    return raw.items.map(normalizeDocument);
  }

  if (Array.isArray(raw?.data)) {
    return raw.data.map(normalizeDocument);
  }

  return [];
}

export async function GET(request: NextRequest) {
  try {
    if (!BASE_URL) {
      return NextResponse.json(
        { success: false, message: "Manjka BIZBOX_BASE_URL." },
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

    const url = `${BASE_URL}/documents?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json, text/plain, */*",
      },
      cache: "no-store",
    });

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

    const documents = normalizeResponse(raw);

    return NextResponse.json({
      success: true,
      documents,
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