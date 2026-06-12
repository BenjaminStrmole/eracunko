"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "../components/AppShell";

type DraftInvoice = {
  id?: number;
  number: string;
  createdAt?: string;
  updatedAt?: string;
  buyer?: {
    name?: string;
    vat?: string;
  };
  totals?: {
    gross?: number;
  };
  status?: string;
};

function formatMoney(value?: number) {
  return new Intl.NumberFormat("sl-SI", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}

function formatDate(value?: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("sl-SI", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function DraftsPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftInvoice[]>([]);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("drafts") || "[]");
    queueMicrotask(() => setDrafts(saved));
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const sortedDrafts = useMemo(
    () =>
      [...drafts].sort((a, b) => {
        const first = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const second = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return second - first;
      }),
    [drafts]
  );

  function openDraft(draft: DraftInvoice) {
    router.push(`/invoices/new?draft=${encodeURIComponent(draft.number)}`);
  }

  function copyDraft(draft: DraftInvoice) {
    const copy = {
      ...draft,
      id: Date.now(),
      number: `${draft.number}-KOPIJA`,
      status: "DRAFT",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = [copy, ...drafts];
    setDrafts(updated);
    localStorage.setItem("drafts", JSON.stringify(updated));
    setToast("Osnutek je kopiran.");
  }

  function deleteDraft(number: string) {
    const updated = drafts.filter((draft) => draft.number !== number);
    setDrafts(updated);
    localStorage.setItem("drafts", JSON.stringify(updated));
    setToast("Osnutek je izbrisan.");
  }

  return (
    <AppShell>
      {toast && (
        <div className="glass-panel fixed right-5 top-5 z-50 max-w-md rounded-2xl px-5 py-4 text-sm text-[var(--foreground)]">
          ℹ️ {toast}
        </div>
      )}

      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="status-pill mb-4 inline-flex">Delovni dokumenti</div>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Osnutki
          </h1>
          <p className="app-muted mt-3">
            Nedokončani računi, ki čakajo na predogled ali pošiljanje.
          </p>
        </div>

        <Link
          href="/invoices/new"
          className="primary-button h-12 px-6"
        >
          + Nov račun
        </Link>
      </div>

      <div className="solid-panel overflow-hidden rounded-[1.75rem]">
        <div className="grid grid-cols-6 border-b border-[var(--app-border)] px-6 py-4 text-sm app-muted">
          <div>Številka</div>
          <div>Kupec</div>
          <div>Znesek</div>
          <div>Status</div>
          <div>Posodobljeno</div>
          <div>Akcije</div>
        </div>

        {sortedDrafts.length === 0 && (
          <div className="app-muted px-6 py-8">
            Ni shranjenih osnutkov. Ustvari račun in klikni Shrani osnutek.
          </div>
        )}

        {sortedDrafts.map((draft) => (
          <div
            key={`${draft.id || draft.number}`}
            className="grid grid-cols-6 items-center border-b border-[var(--app-border)] px-6 py-4 last:border-b-0"
          >
            <div className="font-medium">{draft.number}</div>
            <div className="app-muted">{draft.buyer?.name || "-"}</div>
            <div className="app-muted">{formatMoney(draft.totals?.gross)}</div>
            <div>
              <span className="rounded-full bg-amber-500/10 px-3 py-1 text-sm font-semibold text-amber-500">
                {draft.status || "DRAFT"}
              </span>
            </div>
            <div className="app-muted">
              {formatDate(draft.updatedAt || draft.createdAt)}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => openDraft(draft)}
                className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm font-medium text-[var(--app-primary-strong)] hover:bg-[var(--app-soft)]"
              >
                Odpri
              </button>
              <button
                onClick={() => copyDraft(draft)}
                className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm font-medium hover:bg-[var(--app-soft)]"
              >
                Kopiraj
              </button>
              <button
                onClick={() => deleteDraft(draft.number)}
                className="rounded-xl border border-red-500/25 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10"
              >
                Izbriši
              </button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
