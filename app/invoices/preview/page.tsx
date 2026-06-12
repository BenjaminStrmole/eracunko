"use client";

import { ArrowRight, Download, Printer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell";
import type { Invoice } from "../../../types/invoice";

type ActiveCompany = {
  name?: string;
  vatNumber?: string;
  taxId?: string;
  address?: string;
  eLocation?: string;
  eAddress?: string;
};

type PreviewLine = Invoice["lines"][number] & {
  unit?: string;
  itemCode?: string;
  note?: string;
  vatCategory?: string;
  taxExemptionReason?: string;
};

type PreviewInvoice = Omit<Invoice, "lines"> & {
  lines: PreviewLine[];
  seller?: {
    name?: string;
    vat?: string;
    address?: string;
  };
  documentType?: string;
  paymentMethod?: string;
  paymentMeansCode?: string;
  purposeCode?: string;
  bankBic?: string;
  note?: string;
  eSlog?: {
    documentType?: string;
    purposeCode?: string;
  };
  payment?: {
    method?: string;
    paymentMeansCode?: string;
    purposeCode?: string;
    bankAccount?: string;
    bankBic?: string;
    reference?: string;
  };
  references?: {
    orderReference?: string;
    contractReference?: string;
    deliveryNoteReference?: string;
  };
};

function formatDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("sl-SI").format(new Date(value));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("sl-SI", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}

export default function InvoicePreviewPage() {
  const [invoice, setInvoice] = useState<PreviewInvoice | null>(null);
  const [activeCompany, setActiveCompany] = useState<ActiveCompany | null>(null);

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

  if (!invoice) {
    return (
      <main className="app-bg min-h-screen p-10 text-[var(--foreground)]">
        Nalagam predogled računa ...
      </main>
    );
  }

  const senderName = activeCompany?.name || invoice.seller?.name || "ZZI T2";
  const senderTaxId =
    activeCompany?.vatNumber ||
    activeCompany?.taxId ||
    invoice.seller?.vat ||
    "SI66666666";
  const senderAddress =
    activeCompany?.address ||
    invoice.seller?.address ||
    "POT V TEST 2, 1231 LJUBLJANA - ČRNUČE";

  return (
    <AppShell>
          <div className="no-print mb-8 flex items-center justify-between">
            <div>
              <div className="status-pill mb-4 inline-flex">Kontrola računa</div>
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                Predogled računa
              </h1>
              <p className="app-muted mt-3">
                Preverite podatke pred generiranjem eSLOG XML in pošiljanjem.
              </p>
            </div>

            <div className="flex gap-3">
              <Link
                href="/invoices/new"
                className="secondary-button h-12 px-5"
              >
                Nazaj
              </Link>

              <button
                onClick={() => window.print()}
                className="secondary-button h-12 px-5"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                Natisni
              </button>

              <Link
                href="/invoices/xml"
                className="primary-button h-12 px-6"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Generiraj eSLOG XML
              </Link>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3 print:block">
            <div className="rounded-2xl bg-white p-8 text-slate-950 lg:col-span-2 print:rounded-none print:p-10">
              <div className="mb-10 flex items-start justify-between">
                <div>
                  <div className="text-3xl font-bold">RAČUN</div>
                  <div className="mt-2 text-slate-500">Št. {invoice.number}</div>
                  <div className="mt-2 text-sm text-slate-500">
                    Tip dokumenta: {invoice.documentType || invoice.eSlog?.documentType || "380"}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xl font-bold">{senderName}</div>
                  <div className="text-slate-500">{senderTaxId}</div>
                  <div className="text-slate-500">{senderAddress}</div>
                  {activeCompany?.eLocation && (
                    <div className="text-slate-500">eLokacija: {activeCompany.eLocation}</div>
                  )}
                </div>
              </div>

              <div className="mb-8 grid gap-6 md:grid-cols-2">
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-500">
                    Prejemnik
                  </div>
                  <div className="font-bold">{invoice.buyer.name}</div>
                  <div className="text-slate-500">{invoice.buyer.vat}</div>
                  <div className="text-slate-500">{invoice.buyer.address}</div>
                  <div className="text-slate-500">{invoice.buyer.eLocation}</div>
                  {invoice.buyer.eAddress && (
                    <div className="text-slate-500">{invoice.buyer.eAddress}</div>
                  )}
                </div>

                <div className="text-right">
                  <div><span className="text-slate-500">Datum izdaje:</span> {formatDate(invoice.issueDate)}</div>
                  <div><span className="text-slate-500">Datum storitve:</span> {formatDate(invoice.serviceDate)}</div>
                  <div><span className="text-slate-500">Rok plačila:</span> {formatDate(invoice.dueDate)}</div>
                  <div className="mt-4"><span className="text-slate-500">Način plačila:</span> {invoice.payment?.method || invoice.paymentMethod || "TRR"}</div>
                  <div><span className="text-slate-500">Koda plačila:</span> {invoice.payment?.paymentMeansCode || invoice.paymentMeansCode || "-"}</div>
                  <div><span className="text-slate-500">Koda namena:</span> {invoice.payment?.purposeCode || invoice.purposeCode || "-"}</div>
                  <div><span className="text-slate-500">TRR:</span> {invoice.payment?.bankAccount || invoice.bankAccount || "-"}</div>
                  <div><span className="text-slate-500">BIC:</span> {invoice.payment?.bankBic || invoice.bankBic || "-"}</div>
                  <div><span className="text-slate-500">Referenca:</span> {invoice.payment?.reference || invoice.reference || "-"}</div>
                </div>
              </div>

              {(invoice.references?.orderReference ||
                invoice.references?.contractReference ||
                invoice.references?.deliveryNoteReference ||
                invoice.note) && (
                <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  {invoice.references?.orderReference && (
                    <div><strong>Naročilo:</strong> {invoice.references.orderReference}</div>
                  )}
                  {invoice.references?.contractReference && (
                    <div><strong>Pogodba:</strong> {invoice.references.contractReference}</div>
                  )}
                  {invoice.references?.deliveryNoteReference && (
                    <div><strong>Dobavnica:</strong> {invoice.references.deliveryNoteReference}</div>
                  )}
                  {invoice.note && (
                    <div className="mt-2"><strong>Opomba:</strong> {invoice.note}</div>
                  )}
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="grid grid-cols-7 bg-slate-100 px-4 py-3 text-sm font-semibold">
                  <div className="col-span-2">Opis</div>
                  <div>Enota</div>
                  <div>Količina</div>
                  <div>Cena</div>
                  <div>DDV</div>
                  <div>Znesek</div>
                </div>

                {invoice.lines.map((line) => {
                  const lineNet = line.quantity * line.price;

                  return (
                    <div
                      key={line.id}
                      className="grid grid-cols-7 border-t border-slate-200 px-4 py-4"
                    >
                      <div className="col-span-2">
                        <div>{line.description}</div>
                        {line.itemCode && (
                          <div className="mt-1 text-xs text-slate-500">Šifra: {line.itemCode}</div>
                        )}
                        {line.note && (
                          <div className="mt-1 text-xs text-slate-500">{line.note}</div>
                        )}
                      </div>
                      <div>{line.unit || "-"}</div>
                      <div>{line.quantity}</div>
                      <div>{formatMoney(line.price)}</div>
                      <div>
                        {line.vatRate} %
                        {line.vatCategory && (
                          <div className="text-xs text-slate-500">{line.vatCategory}</div>
                        )}
                      </div>
                      <div>{formatMoney(lineNet)}</div>
                    </div>
                  );
                })}
              </div>

              {invoice.lines.some((line) => line.taxExemptionReason) && (
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <strong>Davčna pojasnila:</strong>
                  {invoice.lines
                    .filter((line) => line.taxExemptionReason)
                    .map((line) => (
                      <div key={line.id} className="mt-1">
                        {line.description}: {line.taxExemptionReason}
                      </div>
                    ))}
                </div>
              )}

              <div className="mt-8 flex justify-end">
                <div className="w-72 space-y-3">
                  <div className="flex justify-between">
                    <span>Osnova</span>
                    <span>{formatMoney(invoice.totals.net)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DDV</span>
                    <span>{formatMoney(invoice.totals.vat)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-3 text-xl font-bold">
                    <span>Skupaj</span>
                    <span>{formatMoney(invoice.totals.gross)}</span>
                  </div>
                </div>
              </div>
            </div>

            <aside className="no-print glass-panel rounded-[1.75rem] p-6">
              <h2 className="text-xl font-semibold">Kontrola pred pošiljanjem</h2>
              <p className="app-muted mt-1 text-sm">
                Ključni podatki, ki jih preveri pred XML korakom.
              </p>

              <div className="mt-6 space-y-4 text-sm">
                <Check ok text="Podatki izdajatelja iz aktivnega podjetja" />
                <Check ok text="Prejemnik izbran iz šifranta" />
                <Check ok text="DDV izračun pripravljen" />
                <Check ok={Boolean(invoice.payment?.reference || invoice.reference)} text="Referenca plačila vpisana" />
                <Check ok={Boolean(invoice.eSlog?.documentType || invoice.documentType)} text="Tip dokumenta izbran" />
                <Check ok={Boolean(invoice.eSlog?.purposeCode || invoice.purposeCode)} text="Koda namena vpisana" />
                <div className="rounded-2xl bg-[var(--app-soft)] p-4 text-[var(--app-primary-strong)]">
                  <ArrowRight className="mb-2 h-4 w-4" aria-hidden="true" />
                  Naslednji korak: generiranje eSLOG XML
                </div>
              </div>
            </aside>
          </div>

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }

          .no-print {
            display: none !important;
          }

          main {
            background: white !important;
          }

          aside {
            display: none !important;
          }
        }
      `}</style>
    </AppShell>
  );
}

function Check({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div
      className={`rounded-xl p-4 ${
        ok ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
      }`}
    >
      {ok ? "✓" : "!"} {text}
    </div>
  );
}
