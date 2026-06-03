"use client";

import { useMemo, useState } from "react";

type InvoiceLine = {
  id: number;
  description: string;
  quantity: number;
  price: number;
  vatRate: number;
};

export default function NewInvoicePage() {
  const [lines, setLines] = useState<InvoiceLine[]>([
    {
      id: 1,
      description: "Svetovanje",
      quantity: 1,
      price: 100,
      vatRate: 22,
    },
  ]);

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
          <div className="mb-8">
            <h2 className="text-4xl font-bold">Nov e-račun</h2>
            <p className="mt-2 text-slate-400">
              Ustvarite račun po korakih. Na koncu bo pripravljen PDF in eSLOG XML.
            </p>
          </div>

          <div className="mb-8 grid max-w-5xl grid-cols-5 gap-3">
            {["Kupec", "Postavke", "Plačilo", "Predogled", "Pošiljanje"].map((step, index) => (
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
            ))}
          </div>

          <div className="grid max-w-7xl gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
              <h3 className="text-2xl font-bold">1. Podatki kupca</h3>
              <p className="mt-2 text-slate-400">
                Poiščite kupca po davčni številki ali izberite iz šifranta strank.
              </p>

              <div className="mt-6">
                <label className="mb-2 block text-sm text-slate-300">
                  Davčna številka kupca
                </label>

                <div className="flex gap-3">
                  <input
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-800 p-3"
                    placeholder="SI12345678"
                  />

                  <button className="rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500">
                    Preveri
                  </button>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-green-500/20 bg-green-500/10 p-5">
                <div className="text-sm text-green-300">Prejemnik najden</div>
                <h4 className="mt-2 text-xl font-bold">ABC d.o.o.</h4>

                <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                  <div><span className="text-slate-500">Davčna:</span> SI12345678</div>
                  <div><span className="text-slate-500">Status:</span> Prejema e-račune</div>
                  <div><span className="text-slate-500">eLokacija:</span> C:SI12345678</div>
                  <div><span className="text-slate-500">Format:</span> eSLOG 2.0</div>
                </div>
              </div>

              <div className="mt-10 border-t border-slate-800 pt-8">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">2. Postavke računa</h3>
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
                          <div className="font-semibold">Postavka {index + 1}</div>

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
                              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3"
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
                              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3"
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
                              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3"
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
                              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3"
                            >
                              <option value={22}>22 %</option>
                              <option value={9.5}>9,5 %</option>
                              <option value={5}>5 %</option>
                              <option value={0}>0 %</option>
                            </select>
                          </div>

                          <div className="md:col-span-3 rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
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

                <a
                  href="/invoices/preview"
                  className="rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
                >
                  Nadaljuj na predogled
                </a>
              </div>
            </div>

            <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h3 className="text-xl font-bold">Povzetek računa</h3>

              <div className="mt-6 space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Kupec</span>
                  <span>ABC d.o.o.</span>
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