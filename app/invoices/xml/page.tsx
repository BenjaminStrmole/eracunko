"use client";

import { Download, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { loadActiveCompanyWithFallback } from "../../../lib/client/activeCompany";
import { saveDbLocalSentInvoice } from "../../../lib/client/localSentInvoices";
import { prepareInvoiceForEslog } from "../../../lib/eslog/prepareInvoiceForEslog";
import type { Invoice, Party } from "../../../types/invoice";
import AppShell from "../../components/AppShell";
import CompanySelector from "../../components/CompanySelector";
import { useToast } from "../../components/ToastProvider";

type SenderCompany = {
  name?: string;
  vatNumber?: string;
  taxId?: string;
  address?: string;
  postCode?: string;
  city?: string;
  country?: string;
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

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeTaxId(value: string | undefined | null) {
  return String(value || "").replace(/\s/g, "").toUpperCase();
}

function countryFromTaxId(value: string | undefined | null) {
  const normalized = normalizeTaxId(value);
  if (/^[A-Z]{2}/.test(normalized)) return normalized.slice(0, 2);
  return "SI";
}

function companyToParty(company: SenderCompany | null, fallback?: Party): Party | undefined {
  if (!company && !fallback) return undefined;

  const taxId = normalizeTaxId(
    company?.vatNumber || company?.taxId || fallback?.vat || fallback?.taxId
  );
  const oib = taxId.replace(/\D/g, "").slice(0, 11);

  return {
    name: company?.name || fallback?.name || "",
    vat: taxId,
    taxId,
    oib,
    address: company?.address || fallback?.address || "",
    postCode: company?.postCode || fallback?.postCode || "",
    city: company?.city || fallback?.city || "",
    country: company?.country || fallback?.country || countryFromTaxId(taxId),
    eLocation: company?.eLocation || fallback?.eLocation || "",
    eAddress: company?.eAddress || fallback?.eAddress || "",
    endpointId: oib || taxId,
    endpointSchemeId: "9934",
  };
}

export default function InvoiceXmlPage() {
  const toast = useToast();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [activeCompany, setActiveCompany] = useState<SenderCompany | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [xmlReadyToastKey, setXmlReadyToastKey] = useState("");

  useEffect(() => {
    const load = async () => {
      const saved = localStorage.getItem("eracunko_current_invoice");

      if (!saved) {
        window.location.href = "/invoices/new";
        return;
      }

      setInvoice(safeJsonParse<Invoice | null>(saved, null));
      setActiveCompany((await loadActiveCompanyWithFallback()) as SenderCompany | null);
    };

    queueMicrotask(load);
    window.addEventListener("active-company-changed", load);

    return () => window.removeEventListener("active-company-changed", load);
  }, []);

  const invoiceForXml = useMemo(() => {
    if (!invoice) return null;

    return {
      ...invoice,
      seller: companyToParty(activeCompany, invoice.seller),
    };
  }, [activeCompany, invoice]);

  const prepared = useMemo(() => {
    if (!invoiceForXml) return null;
    return prepareInvoiceForEslog(invoiceForXml);
  }, [invoiceForXml]);

  const xml = prepared?.xml || "";
  const validation = prepared?.validation;

  useEffect(() => {
    if (!prepared || !xml) return;

    const key = `${prepared.invoice.number}-${prepared.invoice.seller?.vat || ""}`;
    if (xmlReadyToastKey === key) return;

    toast.info(
      "XML je generiran",
      `Račun ${prepared.invoice.number} je pripravljen za pregled ali prenos.`
    );
    setXmlReadyToastKey(key);
  }, [prepared, toast, xml, xmlReadyToastKey]);

  async function sendToBizBox() {
    if (!prepared || !prepared.validation.valid || !xml) {
      toast.error(
        "Pošiljanje je blokirano",
        "Račun ima validacijske napake. Preveri validacijski seznam."
      );
      setSendResult({
        success: false,
        message: "Račun ima validacijske napake. Pošiljanje je blokirano.",
        errors: prepared?.validation.errors || [],
        warnings: prepared?.validation.warnings || [],
      });
      return;
    }

    setSending(true);
    setSendResult(null);

    try {
      const response = await fetch("/api/bizbox/send-invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invoice: prepared.invoice,
        }),
      });

      const data = (await response.json()) as BizBoxSendResponse;

      if (!data.success) {
        toast.error(
          "Pošiljanje ni uspelo",
          data.message || "bizBox je vrnil napako pri pošiljanju."
        );
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
        ...prepared.invoice,
        docId: data.docId,
        status: "SENT",
        sentAt: new Date().toISOString(),
      };

      const existingSent = safeJsonParse<StoredSentInvoice[]>(
        localStorage.getItem("sent"),
        []
      );
      const filteredSent = existingSent.filter(
        (item) => item.number !== sentInvoice.number
      );

      localStorage.setItem("sent", JSON.stringify([...filteredSent, sentInvoice]));
      localStorage.setItem("eracunko_current_invoice", JSON.stringify(sentInvoice));

      saveDbLocalSentInvoice(sentInvoice).catch(() => {
        toast.warning(
          "Račun je poslan, zapis v bazo pa ni uspel",
          "Lokalna kopija je shranjena v brskalniku."
        );
      });

      setInvoice(sentInvoice);
      toast.success(
        "Račun je bil uspešno poslan",
        data.docId
          ? `Dokument je bil oddan v pošiljanje. ID: ${data.docId}`
          : "Dokument je bil oddan v pošiljanje."
      );
      if ((data.validationWarnings || []).length > 0) {
        toast.warning(
          "Pošiljanje ima opozorila",
          (data.validationWarnings || []).slice(0, 2).join(" ")
        );
      }
      setSendResult({
        success: true,
        message: data.message || "Dokument uspešno poslan.",
        docId: data.docId,
        warnings: data.validationWarnings || [],
      });
    } catch (error) {
      toast.error(
        "Pošiljanje ni uspelo",
        error instanceof Error ? error.message : "Napaka pri pošiljanju."
      );
      setSendResult({
        success: false,
        message: error instanceof Error ? error.message : "Napaka pri pošiljanju.",
      });
    } finally {
      setSending(false);
    }
  }

  if (!invoice || !prepared) {
    return (
      <main className="app-bg min-h-screen p-10 text-[var(--foreground)]">
        Nalagam XML ...
      </main>
    );
  }

  return (
    <AppShell>
      <div className="mb-8" data-tour="xml-header">
        <div className="status-pill mb-4 inline-flex">eSLOG izvoz</div>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          eSLOG XML
        </h1>
        <p className="app-muted mt-3 max-w-2xl">
          XML se generira iz normaliziranega računa in aktivnega podjetja.
        </p>
      </div>

      <div className="mt-6 max-w-3xl">
        <CompanySelector />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        <Metric label="BT-106 neto" value={`${prepared.invoice.totals.net.toFixed(2)} EUR`} />
        <Metric label="BT-110 DDV" value={`${prepared.invoice.totals.vat.toFixed(2)} EUR`} />
        <Metric label="BT-112 bruto" value={`${prepared.invoice.totals.gross.toFixed(2)} EUR`} />
        <Metric label="BT-115 plačilo" value={`${(prepared.invoice.totals.payable || prepared.invoice.totals.gross).toFixed(2)} EUR`} />
      </div>

      <section className="solid-panel mt-6 rounded-[1.75rem] p-6" data-tour="xml-validation">
        <h2 className="text-xl font-semibold">Validacija</h2>
        <ValidationList errors={validation?.errors || []} warnings={validation?.warnings || []} />
      </section>

      <section className="solid-panel mt-6 rounded-[1.75rem] p-6">
        <h2 className="text-xl font-semibold">DDV breakdown</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(prepared.invoice.vatBreakdown || []).map((item) => (
            <div key={`${item.vatCategory}-${item.vatRate}`} className="rounded-2xl bg-[var(--app-soft)] p-4 text-sm">
              <div className="font-semibold">
                {item.vatCategory} · {item.vatRate} %
              </div>
              <div className="app-muted mt-1">
                BT-116 {item.taxableAmount.toFixed(2)} EUR · BT-117 {item.vatAmount.toFixed(2)} EUR
              </div>
              {item.taxExemptionReason && (
                <div className="app-muted mt-1">{item.taxExemptionReason}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      <pre className="mt-8 max-h-[650px] overflow-auto rounded-[1.5rem] border border-[var(--app-border)] bg-slate-950 p-6 text-sm text-blue-100 shadow-[var(--app-shadow-soft)]" data-tour="xml-preview">
        {xml || "XML bo prikazan, ko bodo odpravljene validacijske napake."}
      </pre>

      <div className="mt-6 flex flex-wrap gap-3" data-tour="xml-actions">
        <button
          onClick={() => {
            if (!xml) {
              toast.warning(
                "XML še ni pripravljen",
                "Najprej odpravi validacijske napake."
              );
              return;
            }
            const blob = new Blob([xml], { type: "application/xml" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `racun-${prepared.invoice.number}.xml`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success(
              "XML je pripravljen za prenos",
              `Datoteka racun-${prepared.invoice.number}.xml je bila ustvarjena.`
            );
          }}
          disabled={!xml}
          className="primary-button h-12 px-6 disabled:opacity-60"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Prenesi XML
        </button>

        <button
          onClick={sendToBizBox}
          disabled={sending || !validation?.valid}
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

          <ValidationList
            errors={sendResult.errors || []}
            warnings={sendResult.warnings || []}
          />

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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="app-muted text-xs">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function ValidationList({
  errors,
  warnings,
}: {
  errors: string[];
  warnings: string[];
}) {
  if (errors.length === 0 && warnings.length === 0) {
    return <div className="mt-3 text-sm text-emerald-500">Ni napak.</div>;
  }

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {errors.length > 0 && (
        <div className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-500">
          <strong>Napake</strong>
          <ul className="mt-2 list-disc pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-500">
          <strong>Opozorila</strong>
          <ul className="mt-2 list-disc pl-5">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
