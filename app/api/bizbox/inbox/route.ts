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
    number:
      item.externalid ||
      item.title ||
      item.filename ||
      `Dokument ${index + 1}`,
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

function getParamFromMetadata(metadata: any, name: string) {
  const params = metadata?.parameters?.param || [];
  const found = params.find((param: any) => param.parameterName === name);
  return found?.parameterValue || "";
}

function isAcknowledgement(doc: any) {
  const raw = doc.raw || {};
  const classification =
    raw.classificationname || raw.classificationName || raw.classification || "";

  return (
    doc.type === "Povratnica" ||
    raw.type === "Povratnica" ||
    String(classification).toLowerCase().includes("iftman")
  );
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

async function enrichDocumentsWithMetadata(
  documents: any[],
  guid: string,
  limit: number
) {
  const safeLimit = Math.max(0, Math.min(limit, 300));

  const enriched: any[] = [];
  const toEnrich = documents.slice(0, safeLimit);

  for (const doc of toEnrich) {
    if (!isAcknowledgement(doc)) {
      enriched.push(doc);
      continue;
    }

    const metadata = await getDocumentMetadata(doc.id, guid);

    if (!metadata) {
      enriched.push(doc);
      continue;
    }

    const confirmationType = getParamFromMetadata(metadata, "VrstaPotrditve");
    const refMsgId = getParamFromMetadata(metadata, "RefMsgId");
    const issueDate = getParamFromMetadata(metadata, "DatumIzdaje");
    const description = getParamFromMetadata(metadata, "Opis");
    const roleType = getParamFromMetadata(metadata, "DOC_ROLE_TYPE");

    enriched.push({
      ...doc,
      metadata,
      number: metadata.title || doc.number,
      type: metadata.type || doc.type,
      status: confirmationType || doc.status,
      date: issueDate || doc.date,
      acknowledgement: {
        confirmationType,
        refMsgId,
        issueDate,
        description,
        roleType,
        isError:
          confirmationType?.startsWith("27") ||
          confirmationType?.includes("-99") ||
          metadata.title?.includes("Povratnica(-99)") ||
          description?.includes("[ERROR") ||
          description?.toLowerCase?.().includes("napaka"),
      },
    });
  }

  return [...enriched, ...documents.slice(safeLimit)];
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

    const includeMetadata =
      request.nextUrl.searchParams.get("includeMetadata") === "true";

    const limit = Number(request.nextUrl.searchParams.get("limit") || 25);

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
          message: "Pridobivanje dokumentov iz bizBox ni uspelo.",
          raw,
          debugUrl: url.replace(guid, "***"),
        },
        { status: response.status }
      );
    }

    const normalized = normalizeResponse(raw);

    const documents = includeMetadata
      ? await enrichDocumentsWithMetadata(normalized, guid, limit)
      : normalized;

    return NextResponse.json({
      success: true,
      documents,
      raw,
      debugUrl: url.replace(guid, "***"),
      metadata: {
        includeMetadata,
        limit,
        enrichedCount: includeMetadata ? Math.min(limit, normalized.length) : 0,
      },
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