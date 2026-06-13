"use client";

import { Copy, FilePlus2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import PaginationControls from "../components/PaginationControls";

const PAGE_SIZE = 25;

type SentInvoice = {
  id?: string;
  number: string;
  receiver?: string;
  amount?: string;
  type?: string;
  status?: string;
  date?: string;
  docId?: string;
  buyer?: {
    name?: string;
    vat?: string;
  };
  lines?: unknown[];
  totals?: {
    gross?: number;
  };
  sentAt?: string;
};

type StoredInvoice = {
  number?: string;
};

type ActiveCompany = {
  vatNumber?: string;
  taxId?: string;
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
  const sent: StoredInvoice[] = JSON.parse(localStorage.getItem("sent") || "[]");
  const drafts: StoredInvoice[] = JSON.parse(
    localStorage.getItem("drafts") || "[]"
  );
  const all = [...sent, ...drafts];

  const sameYear = all.filter((invoice) =>
    String(invoice.number || "").startsWith(`${year}-`)
  );

  return `${year}-${String(sameYear.length + 1).padStart(3, "0")}`;
}

export default function SentInvoicesPage() {
  const [invoices, setInvoices] = useState<SentInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [page, setPage] = useState(1);

  async function loadSentInvoices() {
    setLoading(true);
    setError("");

    try {
      const activeCompany = JSON.parse(
        localStorage.getItem("activeCompany") || "null"
      ) as ActiveCompany | null;

      const taxNumber = activeCompany?.vatNumber || activeCompany?.taxId || "";

      const response = await fetch(
        `/api/bizbox/sent?taxNumber=${encodeURIComponent(taxNumber)}&limit=150`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!data.success) {
        setError(data.message || "Napaka pri pridobivanju poslanih računov.");
        setInvoices([]);
        return;
      }

      const bizboxSent: SentInvoice[] = data.documents || [];
      const localSent: SentInvoice[] = JSON.parse(
        localStorage.getItem("sent") || "[]"
      );

      const merged = [...localSent, ...bizboxSent];
      const unique = merged.filter((invoice, index, array) => {
        const key = invoice.id || invoice.docId || invoice.number;
        return (
          array.findIndex(
            (item) => (item.id || item.docId || item.number) === key
          ) === index
        );
      });

      setInvoices(unique);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Napaka pri pridobivanju poslanih računov.";
      setError(message);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      loadSentInvoices();
    });
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const totalPages = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedInvoices = invoices.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  function copyInvoice(invoice: SentInvoice) {
    if (!invoice.buyer && !invoice.lines) {
      setToast(
        "Tega bizBox dokumenta še ni mogoče kopirati, ker nima shranjene strukture računa v eRačunku."
      );
      return;
    }

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
    <AppShell>
      {toast && (
        <div className="glass-panel fixed right-5 top-5 z-50 max-w-md rounded-2xl px-5 py-4 text-sm text-[var(--foreground)]">
          ℹ️ {toast}
        </div>
      )}

      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="status-pill mb-4 inline-flex">Izhodni dokumenti</div>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Poslani računi
          </h1>
          <p className="app-muted mt-3 max-w-2xl">
            Pregled poslanih e-računov iz bizBoxa in lokalno shranjenih računov.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={loadSentInvoices}
            disabled={loading}
            className="secondary-button h-12 px-5 disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {loading ? "Osvežujem..." : "Osveži"}
          </button>

          <Link href="/invoices/new" className="primary-button h-12 px-6">
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />
            Nov račun
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-500">
          {error}
        </div>
      )}

      <section className="solid-panel overflow-hidden rounded-[1.75rem]">
        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-6 border-b border-[var(--app-border)] px-6 py-4 text-sm app-muted">
              <div>Številka</div>
              <div>Prejemnik</div>
              <div>Znesek</div>
              <div>Status</div>
              <div>Datum</div>
              <div>Akcije</div>
            </div>

            {loading && (
              <div className="app-muted px-6 py-8">Nalagam poslane račune ...</div>
            )}

            {!loading && invoices.length === 0 && !error && (
              <div className="app-muted px-6 py-8">
                Ni najdenih poslanih računov za izbrano podjetje.
              </div>
            )}

            {!loading &&
              pagedInvoices.map((invoice) => {
                const status = invoice.status || "SENT";
                const receiver = invoice.receiver || invoice.buyer?.name || "-";
                const amount =
                  invoice.amount ||
                  (invoice.totals?.gross ? formatMoney(invoice.totals.gross) : "-");
                const date = invoice.date || formatDate(invoice.sentAt);

                return (
                  <div
                    key={`${invoice.id || invoice.docId || invoice.number}`}
                    className="grid grid-cols-6 items-center border-b border-[var(--app-border)] px-6 py-4 last:border-b-0"
                  >
                    <div>
                      <div className="font-medium">{invoice.number}</div>
                      {(invoice.id || invoice.docId) && (
                        <div className="app-muted mt-1 text-xs">
                          ID: {invoice.id || invoice.docId}
                        </div>
                      )}
                    </div>
                    <div className="app-muted">{receiver}</div>
                    <div className="app-muted">{amount}</div>
                    <div>
                      <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-500">
                        {status}
                      </span>
                    </div>
                    <div className="app-muted">{date}</div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => copyInvoice(invoice)}
                        className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm font-medium text-[var(--app-primary-strong)] hover:bg-[var(--app-soft)]"
                      >
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      </button>

                      {(invoice.id || invoice.docId) && (
                        <Link
                          href={`/inbox/${invoice.id || invoice.docId}`}
                          className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm font-medium hover:bg-[var(--app-soft)]"
                        >
                          Odpri
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {!loading && invoices.length > 0 && (
          <PaginationControls
            page={currentPage}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
            totalItems={invoices.length}
            onPageChange={setPage}
          />
        )}
      </section>
    </AppShell>
  );
}
