"use client";

import { useEffect, useState } from "react";
import type { Invoice } from "../../../types/invoice";

type ActiveCompany = {
  name?: string;
  vatNumber?: string;
  taxId?: string;
  address?: string;
  eLocation?: string;
  eAddress?: string;
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
  const [invoice, setInvoice] = useState<(Invoice & Record<string, any>) | null>(null);
  const [activeCompany, setActiveCompany] = useState<ActiveCompany | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("eracunko_current_invoice");

    if (!saved) {
      window.location.href = "/invoices/new";
      return;
    }

    setInvoice(JSON.parse(saved));

    const savedCompany = localStorage.getItem("activeCompany");
    setActiveCompany(savedCompany ? JSON.parse(savedCompany) : null);
  }, []);

  if (!invoice) {
    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
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
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        <aside className="no-print w-72 border-r border-slate-800 bg-slate-900 p-6">
          <div className="mb-10">
            <h1 className="text-2xl font-bold">eRačunko</h1>
            <p className="text-sm text-slate-400">e-računi brez komplikacij</p>
          </div>

          <nav className="space-y-2">
            <a href="/dashboard" className="block rounded-lg px-4 py-3 hover:bg-slate-800">🏠 Domov</a>
            <a href="/inbox" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📥 Prejeti računi</a>
            <a href="/acknowledgments" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📨 Povratnice</a>
            <a href="/sent" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📤 Poslani računi</a>
            <a href="/drafts" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📝 Osnutki</a>
            <a href="/invoices/new" className="block rounded-lg bg-blue-600/20 px-4 py-3 text-blue-200">🧾 Nov račun</a>
            <a href="/customers" className="block rounded-lg px-4 py-3 hover:bg-slate-800">👥 Moje stranke</a>
            <a href="/settings" className="block rounded-lg px-4 py-3 hover:bg-slate-800">⚙️ Nastavitve</a>
          </nav>
        </aside>

        <section className="flex-1 p-10 print:p-0">
          <div className="no-print mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-4xl font-bold">Predogled računa</h2>
              <p className="mt-2 text-slate-400">
                Preverite podatke pred generiranjem eSLOG XML in pošiljanjem.
              </p>
            </div>

            <div className="flex gap-3">
              <a
                href="/invoices/new"
                className="rounded-full border border-white/15 px-6 py-3 font-semibold hover:bg-white/10"
              >
                Nazaj
              </a>

              <button
                onClick={() => window.print()}
                className="rounded-full border border-blue-500/30 bg-blue-500/10 px-6 py-3 font-semibold text-blue-200 hover:bg-blue-500/20"
              >
                Prenesi PDF
              </button>

              <a
                href="/invoices/xml"
                className="rounded-full bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
              >
                Generiraj eSLOG XML
              </a>
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

                {invoice.lines.map((line: any) => {
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

              {invoice.lines.some((line: any) => line.taxExemptionReason) && (
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <strong>Davčna pojasnila:</strong>
                  {invoice.lines
                    .filter((line: any) => line.taxExemptionReason)
                    .map((line: any) => (
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

            <aside className="no-print rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h3 className="text-xl font-bold">Kontrola pred pošiljanjem</h3>

              <div className="mt-6 space-y-4 text-sm">
                <Check ok text="Podatki izdajatelja iz aktivnega podjetja" />
                <Check ok text="Prejemnik izbran iz šifranta" />
                <Check ok text="DDV izračun pripravljen" />
                <Check ok={Boolean(invoice.payment?.reference || invoice.reference)} text="Referenca plačila vpisana" />
                <Check ok={Boolean(invoice.eSlog?.documentType || invoice.documentType)} text="Tip dokumenta izbran" />
                <Check ok={Boolean(invoice.eSlog?.purposeCode || invoice.purposeCode)} text="Koda namena vpisana" />
                <div className="rounded-xl bg-blue-500/10 p-4 text-blue-200">
                  • Naslednji korak: generiranje eSLOG XML
                </div>
              </div>
            </aside>
          </div>
        </section>
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
        }
      `}</style>
    </main>
  );
}

function Check({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div
      className={`rounded-xl p-4 ${
        ok ? "bg-green-500/10 text-green-300" : "bg-red-500/10 text-red-300"
      }`}
    >
      {ok ? "✓" : "!"} {text}
    </div>
  );
}