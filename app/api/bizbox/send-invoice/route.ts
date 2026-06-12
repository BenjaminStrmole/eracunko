import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { prepareInvoiceForEslog } from "@/lib/eslog/prepareInvoiceForEslog";

export const runtime = "nodejs";

const BASE_URL = process.env.BIZBOX_BASE_URL;

function escapeXml(value: string | number | undefined | null) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildEnvelopeXml(data: {
  invoiceNumber: string;
  xmlFileName: string;
  from: {
    name: string;
    taxId: string;
    eAddress: string;
    eLocation: string;
    address: string;
  };
  to: {
    name: string;
    taxId: string;
    eAddress: string;
    eLocation: string;
    address: string;
  };
}) {
  return `<?xml version="1.0"?>
<envelope>
  <header>
    <from>
      <e_address>${escapeXml(data.from.eAddress)}</e_address>
      <e_location>${escapeXml(data.from.eLocation)}</e_location>
      <physical-address>
        <name>${escapeXml(data.from.name)}</name>
        <address>${escapeXml(data.from.address)}</address>
      </physical-address>
    </from>
    <to>
      <e_address>${escapeXml(data.to.eAddress)}</e_address>
      <e_location>${escapeXml(data.to.eLocation)}</e_location>
      <physical-address>
        <name>${escapeXml(data.to.name)}</name>
        <address>${escapeXml(data.to.address)}</address>
      </physical-address>
    </to>
    <subject>${escapeXml(data.invoiceNumber)}</subject>
    <params>
      <param Name="dd_doc_type" Value="0002"/>
      <param Name="dd_doc_type_ver" Value="01"/>
      <param Name="dd_timestamp" Value="${new Date().toISOString()}"/>
    </params>
  </header>
  <document>
    <external_id>${escapeXml(data.invoiceNumber)}</external_id>
    <type>INVOIC</type>
    <format>ESLOG.2_0</format>
    <file_name>${escapeXml(data.xmlFileName)}</file_name>
  </document>
</envelope>`;
}

function normalizeTaxId(value: string | undefined | null) {
  return String(value || "")
    .replace(/\s/g, "")
    .toUpperCase();
}

function looksLikeInvalidSenderEAddress(value: string) {
  const cleaned = value.trim().toUpperCase();

  if (!cleaned) return true;

  return (
    cleaned === "CONSIGN_TEST" ||
    cleaned === "TEST" ||
    cleaned === "DEMO" ||
    cleaned.includes("CONSIGN") ||
    cleaned.includes("TEST")
  );
}

function normalizeSenderEAddress(
  value: string | undefined | null,
  fallbackTaxId: string
) {
  const cleaned = String(value || "").trim();

  if (!looksLikeInvalidSenderEAddress(cleaned)) {
    return cleaned;
  }

  return `${normalizeTaxId(fallbackTaxId)}.HQ`;
}

function normalizeReceiverEAddress(
  value: string | undefined | null,
  fallbackTaxId: string
) {
  const cleaned = String(value || "").trim();

  if (cleaned) return cleaned;

  return `${normalizeTaxId(fallbackTaxId)}.HQ`;
}

function normalizeELocation(
  value: string | undefined | null,
  fallbackTaxId: string
) {
  const cleaned = String(value || "").trim();

  if (cleaned) return cleaned;

  return `C:${normalizeTaxId(fallbackTaxId)}`;
}

export async function POST(request: NextRequest) {
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
        { success: false, message: "Uporabnik ni prijavljen." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const prepared = body.invoice ? prepareInvoiceForEslog(body.invoice) : null;

    if (prepared && !prepared.validation.valid) {
      return NextResponse.json(
        {
          success: false,
          message: "Račun ni pripravljen za eSLOG.",
          errors: prepared.validation.errors,
          warnings: prepared.validation.warnings,
        },
        { status: 400 }
      );
    }

    const preparedInvoice = prepared?.invoice;

    const invoiceNumber =
      body.invoiceNumber || preparedInvoice?.number || body.invoice?.number;

    const xml = body.xml || preparedInvoice?.xml || body.invoice?.xml;

    const buyer = body.buyer ||
      preparedInvoice?.buyer || {
        name: "",
        vat: "",
        address: "",
        eLocation: "",
        eAddress: "",
      };

    const sender = body.sender || preparedInvoice?.seller;

    if (!invoiceNumber || !xml || !buyer?.eLocation) {
      return NextResponse.json(
        {
          success: false,
          message: "Manjkajo podatki za pošiljanje.",
          missing: {
            invoiceNumber: !invoiceNumber,
            xml: !xml,
            buyerELocation: !buyer?.eLocation,
          },
        },
        { status: 400 }
      );
    }

    const senderTaxId = normalizeTaxId(
      sender?.vat || sender?.vatNumber || sender?.taxId || "SI66666666"
    );

    const buyerTaxId = normalizeTaxId(buyer.vat || buyer.taxId);

    const finalSender = {
      name: sender?.name || "ZZI T2",
      taxId: senderTaxId,
      eAddress: normalizeSenderEAddress(sender?.eAddress, senderTaxId),
      eLocation: normalizeELocation(sender?.eLocation, senderTaxId),
      address: sender?.address || "POT V TEST 2, 1231 LJUBLJANA - ČRNUČE",
    };

    const finalBuyer = {
      name: buyer.name,
      taxId: buyerTaxId,
      eAddress: normalizeReceiverEAddress(buyer.eAddress, buyerTaxId),
      eLocation: normalizeELocation(buyer.eLocation, buyerTaxId),
      address: buyer.address || "",
    };

    const safeInvoiceNumber = String(invoiceNumber).replace(/[^\w.-]/g, "_");
    const xmlFileName = `${safeInvoiceNumber}.xml`;

    const envelopeXml = buildEnvelopeXml({
      invoiceNumber,
      xmlFileName,
      from: finalSender,
      to: finalBuyer,
    });

    const zip = new JSZip();

    zip.file("envelope.xml", envelopeXml);
    zip.file(xmlFileName, xml);

    const zipUint8Array = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
    });

    const zipBuffer = Buffer.from(zipUint8Array);

    const params = new URLSearchParams();
    params.set("guid", guid);
    params.set("isArchived", "false");

    const url = `${BASE_URL}/documents?${params.toString()}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        accept: "text/plain",
        "Content-Type": "application/octet-stream",
      },
      body: zipBuffer,
      cache: "no-store",
    });

    const text = await response.text();

    let raw: unknown = text;

    try {
      raw = JSON.parse(text);
    } catch {}

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: "Pošiljanje v bizBox DEMO ni uspelo.",
          raw,
          envelopeXml,
          finalSender,
          finalBuyer,
          validationWarnings: prepared?.validation.warnings || [],
          debugUrl: url.replace(guid, "***"),
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Dokument uspešno poslan v bizBox DEMO.",
      docId: text,
      envelopeXml,
      finalSender,
      finalBuyer,
      validationWarnings: prepared?.validation.warnings || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Napaka pri pošiljanju računa.",
      },
      { status: 500 }
    );
  }
}