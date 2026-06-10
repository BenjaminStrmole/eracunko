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

function getParamFromMetadata(metadata: any, name: string) {
  const params = metadata?.parameters?.param || [];
  const found = params.find((param: any) => param.parameterName === name);
  return found?.parameterValue || "";
}

function normalizeDocument(item: any, index: number) {
  return {
    id: String(item.id || item.docid || item.docId || index),
    number:
      item.externalid ||
      item.title ||
      item.filename ||
      `Dokument ${index + 1}`,
    receiver: item.organization || item.creationlocation || "-",
    type: item.type || item.classificationname || "Dokument",
    status: item.status || "Poslano",
    date: formatDate(item.creationtime || item.insertdate),
    raw: item,
  };
}

function normalizeResponse(raw: any) {
  if (Array.isArray(raw?.document)) return raw.document.map(normalizeDocument);
  if (Array.isArray(raw?.documents)) return raw.documents.map(normalizeDocument);
  if (Array.isArray(raw)) return raw.map(normalizeDocument);
  return [];
}

async function getDocumentMetadata(docId: string, guid: string) {
  if (!BASE_URL) return null;

  const url = `${BASE_URL}/documents/${docId}/metaData?guid=${encodeURIComponent(
    guid
  )}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json, text/plain, */*",
    },
    cache: "no-store",
  });

  if (response.status === 204) return null;

  const text = await response.text();

  let metadata: any = text;

  try {
    metadata = JSON.parse(text);
  } catch {}

  if (!response.ok) return null;

  return metadata;
}

function isOutgoing(metadata: any) {
  const docRole = getParamFromMetadata(metadata, "DOC_ROLE");
  const roleType = getParamFromMetadata(metadata, "DOC_ROLE_TYPE");

  const text = `${docRole} ${roleType} ${metadata?.title || ""} ${
    metadata?.type || ""
  }`.toLowerCase();

  return (
    text.includes("izhodni") ||
    text.includes("poslan") ||
    text.includes("out") ||
    text.includes("outgoing")
  );
}

async function enrichAndFilterSent(documents: any[], guid: string, limit: number) {
  const safeLimit = Math.max(1, Math.min(limit, 300));
  const candidates = documents.slice(0, safeLimit);

  const sent: any[] = [];

  for (const doc of candidates) {
    const metadata = await getDocumentMetadata(doc.id, guid);

    if (!metadata) continue;
    if (!isOutgoing(metadata)) continue;

    const docRole = getParamFromMetadata(metadata, "DOC_ROLE");
    const roleType = getParamFromMetadata(metadata, "DOC_ROLE_TYPE");
    const issueDate = getParamFromMetadata(metadata, "DatumIzdaje");
    const receiverName =
      getParamFromMetadata(metadata, "BY_Naziv") ||
      getParamFromMetadata(metadata, "P_Naziv") ||
      metadata.organization ||
      doc.receiver ||
      "-";

    const amount =
      getParamFromMetadata(metadata, "Zne_Placila_Valuta") ||
      getParamFromMetadata(metadata, "Zne_Placila") ||
      "";

    sent.push({
      ...doc,
      metadata,
      number: metadata.title || doc.number,
      receiver: receiverName,
      type: roleType || metadata.type || doc.type,
      status: docRole || "Izhodni",
      date: issueDate || doc.date,
      amount,
      raw: metadata,
    });
  }

  return sent;
}

export async function GET(request: NextRequest) {
  try {
    if (!BASE_URL || !TAX_ID_FROM) {
      return NextResponse.json(
        {
          success: false,
          message: "Manjka BIZBOX_BASE_URL ali BIZBOX_TAX_ID_FROM.",
        },
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

    const taxNumber =
      request.nextUrl.searchParams.get("taxNumber") || TAX_ID_FROM;

    const limit = Number(request.nextUrl.searchParams.get("limit") || 100);

    const params = new URLSearchParams();
    params.set("guid", guid);
    params.set("taxNumber", taxNumber);

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
          message: "Pridobivanje poslanih dokumentov iz bizBox ni uspelo.",
          raw,
          debugUrl: url.replace(guid, "***"),
        },
        { status: response.status }
      );
    }

    const normalized = normalizeResponse(raw);
    const documents = await enrichAndFilterSent(normalized, guid, limit);

    return NextResponse.json({
      success: true,
      documents,
      raw,
      debugUrl: url.replace(guid, "***"),
      metadata: {
        limit,
        scannedCount: Math.min(limit, normalized.length),
        sentCount: documents.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message:
          error.message || "Napaka pri pridobivanju poslanih dokumentov.",
      },
      { status: 500 }
    );
  }
}