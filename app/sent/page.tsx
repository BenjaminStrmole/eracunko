"use client";

import { useEffect, useState } from "react";

type SentInvoice = {
  number: string;
  buyer?: {
    name?: string;
    vat?: string;
  };
  totals?: {
    gross?: number;
  };
  status?: string;
  sentAt?: string;
  docId?: string;
  [key: string]: any;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("sl-SI", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}

function formatDate(value?: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("sl-SI", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const sent = JSON.parse(localStorage.getItem("sent") || "[]");
  const drafts = JSON.parse(localStorage.getItem("drafts") || "[]");
  const all = [...sent, ...drafts];

  const sameYear = all.filter((invoice: any) =>
    String(invoice.number || "").startsWith(`${year}-`)
  );

  return `${year}-${String(sameYear.length + 1).padStart(3, "0")}`;
}

export default function SentInvoicesPage() {
  const [invoices, setInvoices] = useState<SentInvoice[]>([]);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("sent") || "[]");
    setInvoices(saved.reverse());
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  function copyInvoice(invoice: SentInvoice) {
    const newInvoice = {
      ...invoice,
      number: generateInvoiceNumber(),
      issueDate: new Date().toISOString().slice(0, 10),
      serviceDate: new Date().toISOString().slice(0, 10),
      dueDate: (() => {
        const date = new Date();
        date.setDate(date.getDate() + 15);
        return date.toISOString().slice(0, 10);
      })(),
      status: "DRAFT",
      docId: undefined,
      sentAt: undefined,
    };

    localStorage.setItem("eracunko_current_invoice", JSON.stringify(newInvoice));
    setToast("Račun je kopiran. Odpiram nov račun ...");

    setTimeout(() => {
      window.location.href = "/invoices/new";
    }, 500);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {toast && (
        <div className="fixed right-5 top-5 z-50 max-w-md rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 text-sm text-blue-100 shadow-xl backdrop-blur">
          ℹ️ {toast}
        </div>
      )}

      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-slate-800 bg-slate-900 p-6">
          <div className="mb-10">
            <h1 className="text-2xl font-bold">eRačunko</h1>
            <p className="text-sm text-slate-400">e-računi brez komplikacij</p>
          </div>

          <nav className="space-y-2">
            <a href="/dashboard" className="block rounded-lg px-4 py-3 hover:bg-slate-800">🏠 Domov</a>
            <a href="/inbox" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📥 Prejeti računi</a>
            <a href="/acknowledgments" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📨 Povratnice</a>
            <a href="/sent" className="block rounded-lg bg-blue-600/20 px-4 py-3 text-blue-200">📤 Poslani računi</a>
            <a href="/drafts" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📝 Osnutki</a>
            <a href="/invoices/new" className="block rounded-lg px-4 py-3 hover:bg-slate-800">🧾 Nov račun</a>
            <a href="/customers" className="block rounded-lg px-4 py-3 hover:bg-slate-800">👥 Moje stranke</a>
            <a href="/settings" className="block rounded-lg px-4 py-3 hover:bg-slate-800">⚙️ Nastavitve</a>
          </nav>
        </aside>

        <section className="flex-1 p-10">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-4xl font-bold">Poslani računi</h2>
              <p className="mt-2 text-slate-400">
                Pregled poslanih e-računov, statusov in povratnic.
              </p>
            </div>

            <a
              href="/invoices/new"
              className="rounded-full bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
            >
              + Nov račun
            </a>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900">
            <div className="grid grid-cols-6 border-b border-slate-800 px-6 py-4 text-sm text-slate-400">
              <div>Številka</div>
              <div>Prejemnik</div>
              <div>Znesek</div>
              <div>Status</div>
              <div>Datum</div>
              <div>Akcije</div>
            </div>

            {invoices.length === 0 && (
              <div className="px-6 py-8 text-slate-400">
                Ni še poslanih računov.
              </div>
            )}

            {invoices.map((invoice) => {
              const status = invoice.status || "SENT";

              return (
                <div
                  key={`${invoice.number}-${invoice.docId || ""}`}
                  className="grid grid-cols-6 items-center border-b border-slate-800 px-6 py-4 last:border-b-0"
                >
                  <div>
                    <div className="font-medium">{invoice.number}</div>
                    {invoice.docId && (
                      <div className="mt-1 text-xs text-slate-500">
                        docId: {invoice.docId}
                      </div>
                    )}
                  </div>

                  <div className="text-slate-300">
                    {invoice.buyer?.name || "-"}
                  </div>

                  <div className="text-slate-300">
                    {formatMoney(invoice.totals?.gross || 0)}
                  </div>

                  <div>
                    <span
                      className={`rounded-full px-3 py-1 text-sm ${
                        status === "SENT"
                          ? "bg-green-500/10 text-green-300"
                          : status === "ERROR"
                          ? "bg-red-500/10 text-red-300"
                          : "bg-amber-500/10 text-amber-300"
                      }`}
                    >
                      {status === "SENT"
                        ? "Poslano"
                        : status === "ERROR"
                        ? "Napaka"
                        : status}
                    </span>
                  </div>

                  <div className="text-slate-300">
                    {formatDate(invoice.sentAt)}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => copyInvoice(invoice)}
                      className="rounded-lg border border-blue-500/30 px-3 py-2 text-sm text-blue-300 hover:bg-blue-500/10"
                    >
                      📋 Kopiraj
                    </button>

                    <button
                      onClick={() => {
                        localStorage.setItem(
                          "eracunko_current_invoice",
                          JSON.stringify(invoice)
                        );
                        window.location.href = "/invoices/preview";
                      }}
                      className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
                    >
                      Odpri
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}