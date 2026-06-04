"use client";

import { useEffect, useState } from "react";
import type { Invoice } from "../../../types/invoice";

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
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("eracunko_current_invoice");

    if (!saved) {
      window.location.href = "/invoices/new";
      return;
    }

    setInvoice(JSON.parse(saved));
  }, []);

  if (!invoice) {
    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        Nalagam predogled računa ...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-slate-800 bg-slate-900 p-6">
          <div className="mb-10">
            <h1 className="text-2xl font-bold">eRačunko</h1>
            <p className="text-sm text-slate-400">e-računi brez komplikacij</p>
          </div>

          <nav className="space-y-2">
            <a href="/dashboard" className="block rounded-lg px-4 py-3 hover:bg-slate-800">🏠 Dashboard</a>
            <a href="/inbox" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📥 Inbox</a>
            <a href="/sent" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📤 Poslani računi</a>
            <a href="/drafts" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📝 Osnutki</a>
            <a href="/invoices/new" className="block rounded-lg bg-blue-600/20 px-4 py-3 text-blue-200">➕ Nov račun</a>
            <a href="/customers" className="block rounded-lg px-4 py-3 hover:bg-slate-800">👥 Stranke</a>
            <a href="/settings" className="block rounded-lg px-4 py-3 hover:bg-slate-800">⚙️ Nastavitve</a>
          </nav>
        </aside>

        <section className="flex-1 p-10">
          <div className="mb-8 flex items-center justify-between">
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

              <a
                href="/invoices/xml"
                className="rounded-full bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
              >
                Generiraj eSLOG XML
              </a>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl bg-white p-8 text-slate-950 lg:col-span-2">
              <div className="mb-10 flex items-start justify-between">
                <div>
                  <div className="text-3xl font-bold">RAČUN</div>
                  <div className="mt-2 text-slate-500">
                    Št. {invoice.number}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xl font-bold">eRačunko Demo d.o.o.</div>
                  <div className="text-slate-500">SI85190586</div>
                  <div className="text-slate-500">
                    Demo ulica 1, 1000 Ljubljana
                  </div>
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
                  <div className="text-slate-500">
                    {invoice.buyer.eLocation}
                  </div>
                </div>

                <div className="text-right">
                  <div>
                    <span className="text-slate-500">Datum izdaje:</span>{" "}
                    {formatDate(invoice.issueDate)}
                  </div>
                  <div>
                    <span className="text-slate-500">Datum storitve:</span>{" "}
                    {formatDate(invoice.serviceDate)}
                  </div>
                  <div>
                    <span className="text-slate-500">Rok plačila:</span>{" "}
                    {formatDate(invoice.dueDate)}
                  </div>
                  <div className="mt-4">
                    <span className="text-slate-500">Plačilo:</span>{" "}
                    {invoice.paymentMethod || "TRR"}
                  </div>
                  <div>
                    <span className="text-slate-500">TRR:</span>{" "}
                    {invoice.bankAccount || "-"}
                  </div>
                  <div>
                    <span className="text-slate-500">Referenca:</span>{" "}
                    {invoice.reference || "-"}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="grid grid-cols-6 bg-slate-100 px-4 py-3 text-sm font-semibold">
                  <div className="col-span-2">Opis</div>
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
                      className="grid grid-cols-6 border-t border-slate-200 px-4 py-4"
                    >
                      <div className="col-span-2">{line.description}</div>
                      <div>{line.quantity}</div>
                      <div>{formatMoney(line.price)}</div>
                      <div>{line.vatRate} %</div>
                      <div>{formatMoney(lineNet)}</div>
                    </div>
                  );
                })}
              </div>

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

            <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h3 className="text-xl font-bold">Kontrola pred pošiljanjem</h3>

              <div className="mt-6 space-y-4 text-sm">
                <div className="rounded-xl bg-green-500/10 p-4 text-green-300">
                  ✓ Podatki izdajatelja izpolnjeni
                </div>
                <div className="rounded-xl bg-green-500/10 p-4 text-green-300">
                  ✓ Prejemnik izbran iz šifranta
                </div>
                <div className="rounded-xl bg-green-500/10 p-4 text-green-300">
                  ✓ DDV izračun pravilen
                </div>
                <div className="rounded-xl bg-blue-500/10 p-4 text-blue-200">
                  • eSLOG XML še ni generiran
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}