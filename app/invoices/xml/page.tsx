"use client";

import { Download, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import CompanySelector from "../../components/CompanySelector";
import type { Invoice } from "../../../types/invoice";

type SenderCompany = {
  name?: string;
  vatNumber?: string;
  taxId?: string;
  address?: string;
  eLocation?: string;
  eAddress?: string;
};

type SendResult = {
  success: boolean;
  message: string;
  docId?: string;
  raw?: unknown;
  errors?: string[];
  warnings?: string[];
};

type BizBoxSendResponse = {
  success?: boolean;
  message?: string;
  docId?: string;
  raw?: unknown;
  errors?: string[];
  warnings?: string[];
  validationWarnings?: string[];
};

type SentInvoice = Invoice & {
  docId?: string;
  status: "SENT";
  sentAt: string;
};

type StoredSentInvoice = {
  number?: string;
};

function escapeXml(value: string | number | undefined | null) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatAmount(value: number) {
  return Number(value || 0).toFixed(2);
}

function formatDate(value: string) {
  return String(value || "").replaceAll("-", "");
}

function normalizeVat(value: string | undefined | null) {
  return String(value || "").replace(/\s/g, "").toUpperCase();
}

function getSender(invoice: Invoice, sender?: SenderCompany | null) {
  const taxId = normalizeVat(
    sender?.vatNumber || sender?.taxId || invoice.seller?.vat || invoice.seller?.taxId || "SI66666666"
  );

  return {
    name: sender?.name || invoice.seller?.name || "ZZI T2",
    vat: taxId,
    address:
      sender?.address ||
      invoice.seller?.address ||
      "POT V TEST 2, 1231 LJUBLJANA - ČRNUČE",
    eLocation: sender?.eLocation || invoice.seller?.eLocation || `C:${taxId}`,
    eAddress: sender?.eAddress || invoice.seller?.eAddress || `${taxId}.HQ`,
  };
}

function buildVatCategory(line: Invoice["lines"][number]) {
  if (line.vatCategory) return line.vatCategory;
  return Number(line.vatRate || 0) > 0 ? "S" : "Z";
}

function buildUnit(line: Invoice["lines"][number]) {
  return String(line.unit || "H87").toUpperCase();
}

function generateEslogXml(invoice: Invoice, sender?: SenderCompany | null) {
  const finalSender = getSender(invoice, sender);

  const buyerVat = normalizeVat(invoice.buyer.vat || invoice.buyer.taxId);
  const payment = invoice.payment || {};

  const linesXml = invoice.lines
    .map((line, index) => {
      const quantity = Number(line.quantity || 0);
      const price = Number(line.price || 0);
      const vatRate = Number(line.vatRate || 0);
      const vatCategory = buildVatCategory(line);
      const lineNet = quantity * price;
      const lineVat = vatCategory === "S" ? lineNet * (vatRate / 100) : 0;

      return `
    <G_SG26>
      <S_LIN>
        <D_1082>${index + 1}</D_1082>
      </S_LIN>
      <S_IMD>
        <C_C273>
          <D_7008>${escapeXml(line.description)}</D_7008>
        </C_C273>
      </S_IMD>
      <S_QTY>
        <C_C186>
          <D_6063>47</D_6063>
          <D_6060>${formatAmount(quantity)}</D_6060>
          <D_6411>${escapeXml(buildUnit(line))}</D_6411>
        </C_C186>
      </S_QTY>
      <S_MOA>
        <C_C516>
          <D_5025>203</D_5025>
          <D_5004>${formatAmount(lineNet)}</D_5004>
        </C_C516>
      </S_MOA>
      <S_PRI>
        <C_C509>
          <D_5125>AAA</D_5125>
          <D_5118>${formatAmount(price)}</D_5118>
        </C_C509>
      </S_PRI>
      <S_TAX>
        <D_5283>7</D_5283>
        <C_C241>
          <D_5153>VAT</D_5153>
        </C_C241>
        <C_C243>
          <D_5278>${formatAmount(vatRate)}</D_5278>
        </C_C243>
        <D_5305>${escapeXml(vatCategory)}</D_5305>
      </S_TAX>
      <S_MOA>
        <C_C516>
          <D_5025>124</D_5025>
          <D_5004>${formatAmount(lineVat)}</D_5004>
        </C_C516>
      </S_MOA>
    </G_SG26>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:eslog:2.00">
  <M_INVOIC Id="data">
    <S_UNH>
      <D_0062>${escapeXml(invoice.number)}</D_0062>
      <C_S009>
        <D_0065>INVOIC</D_0065>
        <D_0052>D</D_0052>
        <D_0054>01B</D_0054>
        <D_0051>UN</D_0051>
      </C_S009>
    </S_UNH>

    <S_BGM>
      <C_C002>
        <D_1001>${escapeXml(invoice.documentType || invoice.eSlog?.documentType || "380")}</D_1001>
      </C_C002>
      <C_C106>
        <D_1004>${escapeXml(invoice.number)}</D_1004>
      </C_C106>
    </S_BGM>

    <S_FTX>
      <D_4451>DOC</D_4451>
      <C_C108>
        <D_4440>${escapeXml(invoice.eSlog?.specificationIdentifier || "urn:cen.eu:en16931:2017")}</D_4440>
      </C_C108>
    </S_FTX>

    <S_DTM>
      <C_C507>
        <D_2005>137</D_2005>
        <D_2380>${formatDate(invoice.issueDate)}</D_2380>
        <D_2379>102</D_2379>
      </C_C507>
    </S_DTM>

    <S_DTM>
      <C_C507>
        <D_2005>35</D_2005>
        <D_2380>${formatDate(invoice.serviceDate)}</D_2380>
        <D_2379>102</D_2379>
      </C_C507>
    </S_DTM>

    <S_DTM>
      <C_C507>
        <D_2005>13</D_2005>
        <D_2380>${formatDate(invoice.dueDate)}</D_2380>
        <D_2379>102</D_2379>
      </C_C507>
    </S_DTM>

    <G_SG2>
      <S_NAD>
        <D_3035>BY</D_3035>
        <C_C082>
          <D_3039>${escapeXml(buyerVat)}</D_3039>
        </C_C082>
        <C_C080>
          <D_3036>${escapeXml(invoice.buyer.name)}</D_3036>
        </C_C080>
        <C_C059>
          <D_3042>${escapeXml(invoice.buyer.address)}</D_3042>
        </C_C059>
      </S_NAD>
    </G_SG2>

    <G_SG2>
      <S_NAD>
        <D_3035>SE</D_3035>
        <C_C082>
          <D_3039>${escapeXml(finalSender.vat)}</D_3039>
        </C_C082>
        <C_C080>
          <D_3036>${escapeXml(finalSender.name)}</D_3036>
        </C_C080>
        <C_C059>
          <D_3042>${escapeXml(finalSender.address)}</D_3042>
        </C_C059>
      </S_NAD>
    </G_SG2>

    <G_SG7>
      <S_CUX>
        <C_C504>
          <D_6347>2</D_6347>
          <D_6345>${escapeXml(invoice.currency || "EUR")}</D_6345>
          <D_6343>4</D_6343>
        </C_C504>
      </S_CUX>
    </G_SG7>

    <G_SG8>
      <S_PAT>
        <D_4279>3</D_4279>
      </S_PAT>
    </G_SG8>

    <G_SG12>
      <S_MOA>
        <C_C516>
          <D_5025>9</D_5025>
          <D_5004>${formatAmount(invoice.totals.gross)}</D_5004>
        </C_C516>
      </S_MOA>
    </G_SG12>

    <G_SG16>
      <S_ALC>
        <D_5463>C</D_5463>
      </S_ALC>
    </G_SG16>

    <G_SG34>
      <S_MOA>
        <C_C516>
          <D_5025>77</D_5025>
          <D_5004>${formatAmount(invoice.totals.gross)}</D_5004>
        </C_C516>
      </S_MOA>
    </G_SG34>

    <G_SG1>
      <S_RFF>
        <C_C506>
          <D_1153>AEP</D_1153>
          <D_1154>${escapeXml(payment.reference || invoice.reference || "")}</D_1154>
        </C_C506>
      </S_RFF>
    </G_SG1>

${linesXml}

    <S_UNS>
      <D_0081>S</D_0081>
    </S_UNS>

    <S_MOA>
      <C_C516>
        <D_5025>79</D_5025>
        <D_5004>${formatAmount(invoice.totals.net)}</D_5004>
      </C_C516>
    </S_MOA>

    <S_MOA>
      <C_C516>
        <D_5025>176</D_5025>
        <D_5004>${formatAmount(invoice.totals.vat)}</D_5004>
      </C_C516>
    </S_MOA>

    <S_MOA>
      <C_C516>
        <D_5025>77</D_5025>
        <D_5004>${formatAmount(invoice.totals.gross)}</D_5004>
      </C_C516>
    </S_MOA>
  </M_INVOIC>
</Invoice>`;
}

export default function InvoiceXmlPage() {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [sending, setSending] = useState(false);
  const [activeCompany, setActiveCompany] = useState<SenderCompany | null>(null);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("eracunko_current_invoice");

    if (!saved) {
      window.location.href = "/invoices/new";
      return;
    }

    const savedCompany = localStorage.getItem("activeCompany");

    queueMicrotask(() => {
      setInvoice(JSON.parse(saved));
      setActiveCompany(savedCompany ? JSON.parse(savedCompany) : null);
    });
  }, []);

  const xml = useMemo(() => {
    if (!invoice) return "";
    return generateEslogXml(invoice, activeCompany);
  }, [invoice, activeCompany]);

  async function sendToBizBox() {
    if (!invoice || !xml) return;

    const currentActiveCompany = JSON.parse(
      localStorage.getItem("activeCompany") || "null"
    ) as SenderCompany | null;

    const finalSender = getSender(invoice, currentActiveCompany);

    const invoiceForSend: Invoice = {
      ...invoice,
      seller: {
        name: finalSender.name,
        vat: finalSender.vat,
        taxId: finalSender.vat,
        address: finalSender.address,
        eLocation: finalSender.eLocation,
        eAddress: finalSender.eAddress,
      },
      xml,
    };

    setSending(true);
    setSendResult(null);

    try {
      const response = await fetch("/api/bizbox/send-invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invoice: invoiceForSend,
          invoiceNumber: invoiceForSend.number,
          xml,
          buyer: invoiceForSend.buyer,
          sender: invoiceForSend.seller,
        }),
      });

      const data = (await response.json()) as BizBoxSendResponse;

      if (!data.success) {
        setSendResult({
          success: false,
          message: data.message || "Pošiljanje ni uspelo.",
          raw: data.raw,
          errors: data.errors,
          warnings: data.warnings || data.validationWarnings,
        });
        return;
      }

      const sentInvoice: SentInvoice = {
        ...invoiceForSend,
        docId: data.docId,
        status: "SENT",
        sentAt: new Date().toISOString(),
      };

      const existingSent = JSON.parse(
        localStorage.getItem("sent") || "[]"
      ) as StoredSentInvoice[];

      const filteredSent = existingSent.filter(
        (item) => item.number !== invoice.number
      );

      localStorage.setItem("sent", JSON.stringify([...filteredSent, sentInvoice]));
      localStorage.setItem("eracunko_current_invoice", JSON.stringify(sentInvoice));

      setInvoice(sentInvoice);

      setSendResult({
        success: true,
        message: data.message || "Dokument uspešno poslan.",
        docId: data.docId,
        warnings: data.validationWarnings || [],
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Napaka pri pošiljanju.";

      setSendResult({
        success: false,
        message,
      });
    } finally {
      setSending(false);
    }
  }

  if (!invoice) {
    return (
      <main className="app-bg min-h-screen p-10 text-[var(--foreground)]">
        Nalagam XML ...
      </main>
    );
  }

  return (
    <AppShell>
      <div className="mb-8">
        <div className="status-pill mb-4 inline-flex">eSLOG izvoz</div>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          eSLOG XML
        </h1>
        <p className="app-muted mt-3 max-w-2xl">
          XML dokument je ustvarjen iz trenutnega računa in pripravljen za
          pošiljanje v bizBox DEMO.
        </p>
      </div>

      <div className="mt-6 max-w-3xl">
        <CompanySelector />
      </div>

      <div className="glass-panel mt-4 rounded-2xl p-4 text-sm">
        Izdajatelj v XML:{" "}
        <strong>
          {activeCompany?.name || invoice.seller?.name || "ZZI T2"} (
          {activeCompany?.vatNumber ||
            activeCompany?.taxId ||
            invoice.seller?.vat ||
            "SI66666666"}
          )
        </strong>
      </div>

      <pre className="mt-8 max-h-[650px] overflow-auto rounded-[1.5rem] border border-[var(--app-border)] bg-slate-950 p-6 text-sm text-blue-100 shadow-[var(--app-shadow-soft)]">
        {xml}
      </pre>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => {
            const blob = new Blob([xml], {
              type: "application/xml",
            });

            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = `racun-${invoice.number}.xml`;
            a.click();

            URL.revokeObjectURL(url);
          }}
          className="primary-button h-12 px-6"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Prenesi XML
        </button>

        <button
          onClick={sendToBizBox}
          disabled={sending}
          className="secondary-button h-12 px-6 disabled:opacity-60"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          {sending ? "Pošiljam..." : "Pošlji v bizBox DEMO"}
        </button>
      </div>

      {sendResult && (
        <div
          className={`mt-6 rounded-2xl border p-5 ${
            sendResult.success
              ? "border-green-500/20 bg-green-500/10"
              : "border-red-500/20 bg-red-500/10"
          }`}
        >
          <div
            className={`font-semibold ${
              sendResult.success ? "text-green-300" : "text-red-300"
            }`}
          >
            {sendResult.success ? "✓ " : "✕ "}
            {sendResult.message}
          </div>

          {sendResult.docId && (
            <div className="app-muted mt-3">
              Številka dokumenta:
              <span className="font-bold"> {sendResult.docId}</span>
            </div>
          )}

          {sendResult.warnings && sendResult.warnings.length > 0 && (
            <div className="mt-4 rounded-xl bg-amber-500/10 p-4 text-sm text-amber-200">
              <strong>Opozorila:</strong>
              <ul className="mt-2 list-disc pl-5">
                {sendResult.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {sendResult.errors && sendResult.errors.length > 0 && (
            <div className="mt-4 rounded-xl bg-red-500/10 p-4 text-sm text-red-200">
              <strong>Napake:</strong>
              <ul className="mt-2 list-disc pl-5">
                {sendResult.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {!sendResult.success && sendResult.raw != null && (
            <pre className="mt-4 overflow-auto rounded-xl bg-slate-950 p-4 text-sm text-red-100">
              {typeof sendResult.raw === "string"
                ? sendResult.raw
                : JSON.stringify(sendResult.raw, null, 2) || ""}
            </pre>
          )}
        </div>
      )}
    </AppShell>
  );
}
