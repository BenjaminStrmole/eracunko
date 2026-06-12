"use client";

import { FilePlus2, Star, StarOff, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";

type Customer = {
  name: string;
  vatNumber: string;
  status: "READY" | "NOT_READY";
  eLocation: string;
  format: string;
  isFavorite?: boolean;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("customers") || "[]");
    queueMicrotask(() => setCustomers(saved));
  }, []);

  function saveCustomers(updated: Customer[]) {
    setCustomers(updated);
    localStorage.setItem("customers", JSON.stringify(updated));
  }

  function toggleFavorite(vatNumber: string) {
    const updated = customers.map((customer) =>
      customer.vatNumber === vatNumber
        ? { ...customer, isFavorite: !customer.isFavorite }
        : customer
    );

    saveCustomers(updated);
  }

  function deleteCustomer(vatNumber: string) {
    const updated = customers.filter(
      (customer) => customer.vatNumber !== vatNumber
    );

    saveCustomers(updated);
  }

  const favoriteCustomers = useMemo(
    () => customers.filter((customer) => customer.isFavorite),
    [customers]
  );

  return (
    <AppShell>
      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="status-pill mb-4 inline-flex">Šifrant kupcev</div>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Moje stranke
          </h1>
          <p className="app-muted mt-3 max-w-2xl">
            Shranjene stranke iz eImenika za hitrejšo pripravo in pošiljanje
            e-računov.
          </p>
        </div>

        <Link href="/customers/new" className="primary-button h-12 px-6">
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Nova stranka
        </Link>
      </div>

      <section className="glass-panel mb-8 rounded-[1.75rem] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Priljubljene stranke</h2>
            <p className="app-muted mt-1 text-sm">
              Hiter izbor pri kreiranju novega računa.
            </p>
          </div>
          <span className="status-pill">{favoriteCustomers.length}</span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {favoriteCustomers.length === 0 && (
            <p className="app-muted">Ni še priljubljenih strank.</p>
          )}

          {favoriteCustomers.map((customer) => (
            <Link
              key={customer.vatNumber}
              href={`/invoices/new?vat=${encodeURIComponent(
                customer.vatNumber
              )}`}
              className="solid-panel rounded-[1.25rem] p-4 hover:-translate-y-0.5 hover:border-[var(--app-primary)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{customer.name}</div>
                  <div className="app-muted mt-1 text-sm">{customer.vatNumber}</div>
                </div>
                <Star className="h-4 w-4 text-[var(--app-primary)]" aria-hidden="true" />
              </div>
              <div className="app-muted mt-2 text-xs">
                eLokacija: {customer.eLocation || "-"}
              </div>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--app-primary-strong)]">
                Uporabi v računu
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="solid-panel overflow-hidden rounded-[1.75rem]">
        <div className="grid grid-cols-6 border-b border-[var(--app-border)] px-6 py-4 text-sm app-muted">
          <div>Naziv</div>
          <div>Davčna</div>
          <div>Status</div>
          <div>eLokacija</div>
          <div>Priljubljeno</div>
          <div>Akcije</div>
        </div>

        {customers.length === 0 && (
          <div className="app-muted p-6">
            Ni še shranjenih strank. Dodaj prvo stranko iz eImenika.
          </div>
        )}

        {customers.map((customer) => (
          <div
            key={customer.vatNumber}
            className="grid grid-cols-6 items-center border-b border-[var(--app-border)] px-6 py-4 last:border-b-0"
          >
            <div className="font-medium">{customer.name}</div>
            <div className="app-muted">{customer.vatNumber}</div>
            <div>
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  customer.status === "READY"
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-amber-500/10 text-amber-500"
                }`}
              >
                {customer.status === "READY"
                  ? "Prejema e-račune"
                  : "Ni v eImeniku"}
              </span>
            </div>
            <div className="app-muted break-words text-sm">
              {customer.eLocation || "-"}
            </div>
            <div className="app-muted">{customer.isFavorite ? "Da" : "Ne"}</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => toggleFavorite(customer.vatNumber)}
                className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm font-medium hover:bg-[var(--app-soft)]"
                title={
                  customer.isFavorite
                    ? "Odstrani iz priljubljenih"
                    : "Dodaj med priljubljene"
                }
              >
                {customer.isFavorite ? (
                  <StarOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Star className="h-4 w-4" aria-hidden="true" />
                )}
              </button>

              <Link
                href={`/invoices/new?vat=${encodeURIComponent(
                  customer.vatNumber
                )}`}
                className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm font-medium text-[var(--app-primary-strong)] hover:bg-[var(--app-soft)]"
              >
                Račun
              </Link>

              <button
                onClick={() => deleteCustomer(customer.vatNumber)}
                className="rounded-xl border border-red-500/25 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10"
                title="Izbriši stranko"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
