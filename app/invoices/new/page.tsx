"use client";

import { useEffect, useMemo, useState } from "react";
import type { InvoiceLine, Invoice } from "../../../types/invoice";

type Customer = {
  name: string;
  vatNumber: string;
  status: "READY" | "NOT_READY";
  eLocation: string;
  eAddress?: string;
  eAddress1?: string;
  address?: string;
  postCode?: string;
  city?: string;
  country?: string;
  network?: string;
  receiverChannel?: string;
  format: string;
  isFavorite?: boolean;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatAddress(customer: Customer) {
  return [
    customer.address,
    [customer.postCode, customer.city].filter(Boolean).join(" "),
    customer.country,
  ]
    .filter(Boolean)
    .join(", ");
}

export default function NewInvoicePage() {
  const [invoiceNumber, setInvoiceNumber] = useState("2026-001");
  const [issueDate, setIssueDate] = useState(today());
  const [serviceDate, setServiceDate] = useState(today());
  const [dueDate, setDueDate] = useState(addDays(15));

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [buyer, setBuyer] = useState<Customer | null>(null);
  const [buyerSearch, setBuyerSearch] = useState("");
  const [toast, setToast] = useState("");

  const [lines, setLines] = useState<InvoiceLine[]>([
    {
      id: 1,
      description: "Svetovanje",
      quantity: 1,
      price: 100,
      vatRate: 22,
    },
  ]);

  useEffect(() => {
    const savedCustomers: Customer[] = JSON.parse(
      localStorage.getItem("customers") || "[]"
    );

    setCustomers(savedCustomers);

    const params = new URLSearchParams(window.location.search);
    const vat = params.get("vat");

    if (vat) {
      const selected = savedCustomers.find(
        (customer) => customer.vatNumber === vat
      );

      if (selected) {
        setBuyer(selected);
        setBuyerSearch(selected.name);
      }
    }
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const favoriteCustomers = customers.filter((customer) => customer.isFavorite);

  const filteredCustomers = customers.filter((customer) => {
    const query = buyerSearch.toLowerCase();

    if (!query) return true;

    return (
      customer.name.toLowerCase().includes(query) ||
      customer.vatNumber.toLowerCase().includes(query) ||
      customer.eLocation.toLowerCase().includes(query)
    );
  });

  const totals = useMemo(() => {
    const net = lines.reduce((sum, line) => sum + line.quantity * line.price, 0);

    const vat = lines.reduce(
      (sum, line) => sum + line.quantity * line.price * (line.vatRate / 100),
      0
    );

    return {
      net,
      vat,
      gross: net + vat,
    };
  }, [lines]);

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("sl-SI", {
      style: "currency",
      currency: "EUR",
    }).format(value);

  function updateLine(id: number, field: keyof InvoiceLine, value: string) {
    setLines((current) =>
      current.map((line) =>
        line.id === id
          ? {
              ...line,
              [field]:
                field === "description"
                  ? value
                  : Number(value.replace(",", ".")) || 0,
            }
          : line
      )
    );
  }

  function addLine() {
    setLines((current) => [
      ...current,
      {
        id: Date.now(),
        description: "",
        quantity: 1,
        price: 0,
        vatRate: 22,
      },
    ]);
  }

  function removeLine(id: number) {
    setLines((current) => current.filter((line) => line.id !== id));
  }

  function selectBuyer(customer: Customer) {
    setBuyer(customer);
    setBuyerSearch(customer.name);
  }

  function saveAndPreview() {
    if (!buyer) {
      setToast("Najprej izberi kupca iz šifranta strank.");
      return;
    }

    if (!invoiceNumber.trim()) {
      setToast("Vnesi številko računa.");
      return;
    }

    if (lines.length === 0 || lines.some((line) => !line.description.trim())) {
      setToast("Vsaka postavka mora imeti opis.");
      return;
    }

    const invoice: Invoice = {
      number: invoiceNumber,
      issueDate,
      serviceDate,
      dueDate,
      currency: "EUR",
      buyer: {
        name: buyer.name,
        vat: buyer.vatNumber,
        address: formatAddress(buyer),
        eLocation: buyer.eLocation,
      },
      lines,
      totals,
    };

    localStorage.setItem("eracunko_current_invoice", JSON.stringify(invoice));
    window.location.href = "/invoices/preview";
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {toast && (
        <div className="fixed right-5 top-5 z-50 max-w-md rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200 shadow-xl backdrop-blur">
          ❌ {toast}
        </div>
      )}

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
          <div className="mb-8">
            <h2 className="text-4xl font-bold">Nov e-račun</h2>
            <p className="mt-2 text-slate-400">
              Izberi kupca iz eImenika, dodaj postavke in pripravi račun za predogled.
            </p>
          </div>

          <div className="mb-8 grid max-w-5xl grid-cols-5 gap-3">
            {["Kupec", "Postavke", "Plačilo", "Predogled", "Pošiljanje"].map(
              (step, index) => (
                <div
                  key={step}
                  className={`rounded-xl border p-4 ${
                    index <= 1
                      ? "border-blue-500 bg-blue-500/10 text-blue-200"
                      : "border-slate-800 bg-slate-900 text-slate-400"
                  }`}
                >
                  <div className="text-sm">Korak {index + 1}</div>
                  <div className="mt-1 font-semibold">{step}</div>
                </div>
              )
            )}
          </div>

          <div className="grid max-w-7xl gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
              <h3 className="text-2xl font-bold">1. Podatki računa</h3>

              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <div>
                  <label className="mb-2 block text-sm text-slate-300">
                    Številka
                  </label>
                  <input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-300">
                    Datum izdaje
                  </label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-300">
                    Datum storitve
                  </label>
                  <input
                    type="date"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-300">
                    Rok plačila
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="mt-10 border-t border-slate-800 pt-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">2. Kupec</h3>
                    <p className="mt-2 text-slate-400">
                      Izberi kupca iz šifranta ali dodaj novega iz eImenika.
                    </p>
                  </div>

                  <a
                    href="/customers/new"
                    className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-500/20"
                  >
                    + Dodaj kupca
                  </a>
                </div>

                {favoriteCustomers.length > 0 && (
                  <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5">
                    <h4 className="text-lg font-bold text-blue-100">
                      ⭐ Priljubljene stranke
                    </h4>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {favoriteCustomers.map((customer) => (
                        <button
                          key={customer.vatNumber}
                          onClick={() => selectBuyer(customer)}
                          className={`rounded-xl border p-4 text-left hover:bg-slate-800 ${
                            buyer?.vatNumber === customer.vatNumber
                              ? "border-green-500 bg-green-500/10"
                              : "border-slate-700 bg-slate-900"
                          }`}
                        >
                          <div className="font-bold">{customer.name}</div>
                          <div className="mt-1 text-sm text-slate-400">
                            {customer.vatNumber}
                          </div>
                          <div className="mt-2 text-sm text-green-300">
                            ✓ Prejema e-račune
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-5">
                  <label className="mb-2 block text-sm text-slate-300">
                    Poišči v shranjenih strankah
                  </label>

                  <input
                    value={buyerSearch}
                    onChange={(event) => setBuyerSearch(event.target.value)}
                    placeholder="Naziv, davčna ali eLokacija"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 outline-none focus:border-blue-500"
                  />

                  <div className="mt-4 max-h-72 space-y-2 overflow-auto">
                    {filteredCustomers.length === 0 && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                        Ni shranjenih strank. Najprej dodaj kupca iz eImenika.
                      </div>
                    )}

                    {filteredCustomers.map((customer) => (
                      <button
                        key={customer.vatNumber}
                        onClick={() => selectBuyer(customer)}
                        className={`block w-full rounded-xl border p-4 text-left hover:bg-slate-800 ${
                          buyer?.vatNumber === customer.vatNumber
                            ? "border-green-500 bg-green-500/10"
                            : "border-slate-800 bg-slate-900"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="font-bold">{customer.name}</div>
                            <div className="mt-1 text-sm text-slate-400">
                              {customer.vatNumber} · {customer.eLocation}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {formatAddress(customer) || "Naslov ni shranjen"}
                            </div>
                          </div>

                          <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs text-green-300">
                            e-računi
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {buyer && (
                  <div className="mt-6 rounded-2xl border border-green-500/20 bg-green-500/10 p-5">
                    <div className="text-sm text-green-300">
                      Izbrani prejemnik
                    </div>

                    <h4 className="mt-2 text-xl font-bold">{buyer.name}</h4>

                    <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                      <div>
                        <span className="text-slate-500">Davčna:</span>{" "}
                        {buyer.vatNumber}
                      </div>
                      <div>
                        <span className="text-slate-500">eLokacija:</span>{" "}
                        {buyer.eLocation}
                      </div>
                      <div>
                        <span className="text-slate-500">Naslov:</span>{" "}
                        {buyer.address || "-"}
                      </div>
                      <div>
                        <span className="text-slate-500">Mesto:</span>{" "}
                        {buyer.city || "-"}
                      </div>
                      <div>
                        <span className="text-slate-500">Država:</span>{" "}
                        {buyer.country || "-"}
                      </div>
                      <div>
                        <span className="text-slate-500">Omrežje:</span>{" "}
                        {buyer.network || "-"}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-10 border-t border-slate-800 pt-8">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">3. Postavke računa</h3>
                    <p className="mt-2 text-slate-400">
                      Dodajte eno ali več postavk. Zneski se izračunajo samodejno.
                    </p>
                  </div>

                  <button
                    onClick={addLine}
                    className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 font-semibold text-blue-200 hover:bg-blue-500/20"
                  >
                    + Dodaj postavko
                  </button>
                </div>

                <div className="space-y-4">
                  {lines.map((line, index) => {
                    const lineNet = line.quantity * line.price;
                    const lineVat = lineNet * (line.vatRate / 100);
                    const lineGross = lineNet + lineVat;

                    return (
                      <div
                        key={line.id}
                        className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div className="font-semibold">
                            Postavka {index + 1}
                          </div>

                          {lines.length > 1 && (
                            <button
                              onClick={() => removeLine(line.id)}
                              className="text-sm text-red-300 hover:text-red-200"
                            >
                              Odstrani
                            </button>
                          )}
                        </div>

                        <div className="grid gap-4 md:grid-cols-4">
                          <div className="md:col-span-2">
                            <label className="mb-2 block text-sm text-slate-300">
                              Opis
                            </label>
                            <input
                              value={line.description}
                              onChange={(e) =>
                                updateLine(line.id, "description", e.target.value)
                              }
                              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 outline-none focus:border-blue-500"
                              placeholder="Opis storitve ali artikla"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm text-slate-300">
                              Količina
                            </label>
                            <input
                              type="number"
                              value={line.quantity}
                              onChange={(e) =>
                                updateLine(line.id, "quantity", e.target.value)
                              }
                              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 outline-none focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm text-slate-300">
                              Cena brez DDV
                            </label>
                            <input
                              type="number"
                              value={line.price}
                              onChange={(e) =>
                                updateLine(line.id, "price", e.target.value)
                              }
                              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 outline-none focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm text-slate-300">
                              DDV %
                            </label>
                            <select
                              value={line.vatRate}
                              onChange={(e) =>
                                updateLine(line.id, "vatRate", e.target.value)
                              }
                              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 outline-none focus:border-blue-500"
                            >
                              <option value={22}>22 %</option>
                              <option value={9.5}>9,5 %</option>
                              <option value={5}>5 %</option>
                              <option value={0}>0 %</option>
                            </select>
                          </div>

                          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300 md:col-span-3">
                            Osnova: <strong>{formatMoney(lineNet)}</strong> · DDV:{" "}
                            <strong>{formatMoney(lineVat)}</strong> · Skupaj:{" "}
                            <strong>{formatMoney(lineGross)}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <a
                  href="/dashboard"
                  className="rounded-lg border border-white/15 px-6 py-3 font-semibold hover:bg-white/10"
                >
                  Prekliči
                </a>

                <button
                  onClick={saveAndPreview}
                  className="rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
                >
                  Nadaljuj na predogled
                </button>
              </div>
            </div>

            <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h3 className="text-xl font-bold">Povzetek računa</h3>

              <div className="mt-6 space-y-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Kupec</span>
                  <span className="text-right">
                    {buyer?.name || "Ni izbran"}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">Osnova</span>
                  <span>{formatMoney(totals.net)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">DDV</span>
                  <span>{formatMoney(totals.vat)}</span>
                </div>

                <div className="flex justify-between border-t border-slate-800 pt-4 text-lg font-bold">
                  <span>Skupaj</span>
                  <span>{formatMoney(totals.gross)}</span>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-300">
                ✓ Izračun DDV je pripravljen za eSLOG XML.
              </div>

              <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-200">
                eSLOG XML bo v naslednjem koraku ustvarjen iz teh podatkov.
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}