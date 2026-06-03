"use client";

import { useEffect, useState } from "react";

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
    setCustomers(saved);
  }, []);

  function toggleFavorite(vatNumber: string) {
    const updated = customers.map((customer) =>
      customer.vatNumber === vatNumber
        ? { ...customer, isFavorite: !customer.isFavorite }
        : customer
    );

    setCustomers(updated);
    localStorage.setItem("customers", JSON.stringify(updated));
  }

  function deleteCustomer(vatNumber: string) {
    const updated = customers.filter(
      (customer) => customer.vatNumber !== vatNumber
    );

    setCustomers(updated);
    localStorage.setItem("customers", JSON.stringify(updated));
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
            <a href="/invoices/new" className="block rounded-lg px-4 py-3 hover:bg-slate-800">➕ Nov račun</a>
            <a href="/customers" className="block rounded-lg bg-blue-600/20 px-4 py-3 text-blue-200">👥 Stranke</a>
            <a href="/settings" className="block rounded-lg px-4 py-3 hover:bg-slate-800">⚙️ Nastavitve</a>
          </nav>
        </aside>

        <section className="flex-1 p-10">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-4xl font-bold">Stranke</h2>
              <p className="mt-2 text-slate-400">
                Shranjene stranke iz eImenika za hitrejše kreiranje računov.
              </p>
            </div>

            <a
              href="/customers/new"
              className="rounded-full bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
            >
              + Nova stranka
            </a>
          </div>

          <div className="mb-8 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-6">
            <h3 className="text-xl font-bold text-blue-100">⭐ Priljubljene stranke</h3>
            <p className="mt-2 text-slate-300">
              Te stranke bodo prikazane kot hiter izbor pri kreiranju novega računa.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {customers.filter((c) => c.isFavorite).length === 0 && (
                <p className="text-slate-400">Ni še priljubljenih strank.</p>
              )}

              {customers
                .filter((customer) => customer.isFavorite)
                .map((customer) => (
                  <a
                    key={customer.vatNumber}
                    href={`/invoices/new?vat=${customer.vatNumber}`}
                    className="rounded-xl border border-slate-700 bg-slate-900 p-4 hover:bg-slate-800"
                  >
                    <div className="font-bold">{customer.name}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {customer.vatNumber}
                    </div>
                    <div className="mt-3 text-sm text-green-300">
                      ✓ Prejema e-račune
                    </div>
                  </a>
                ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900">
            <div className="grid grid-cols-5 border-b border-slate-800 px-6 py-4 text-sm text-slate-400">
              <div>Naziv</div>
              <div>Davčna</div>
              <div>Status</div>
              <div>Priljubljeno</div>
              <div>Akcije</div>
            </div>

            {customers.length === 0 && (
              <div className="p-6 text-slate-400">
                Ni še shranjenih strank. Dodaj prvo stranko.
              </div>
            )}

            {customers.map((customer) => (
              <div
                key={customer.vatNumber}
                className="grid grid-cols-5 items-center border-b border-slate-800 px-6 py-4 last:border-b-0"
              >
                <div className="font-medium">{customer.name}</div>
                <div className="text-slate-300">{customer.vatNumber}</div>
                <div>
                  <span
                    className={`rounded-full px-3 py-1 text-sm ${
                      customer.status === "READY"
                        ? "bg-green-500/10 text-green-300"
                        : "bg-amber-500/10 text-amber-300"
                    }`}
                  >
                    {customer.status === "READY"
                      ? "Prejema e-račune"
                      : "Ni v eImeniku"}
                  </span>
                </div>
                <div>{customer.isFavorite ? "⭐ Da" : "☆ Ne"}</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleFavorite(customer.vatNumber)}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
                  >
                    ⭐
                  </button>

                  <button
                    onClick={() => deleteCustomer(customer.vatNumber)}
                    className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"
                  >
                    Izbriši
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}