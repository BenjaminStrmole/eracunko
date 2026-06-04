"use client";

import { useEffect, useState } from "react";

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

const SUPPORTED_COUNTRY_PREFIXES = [
  "SI",
  "HR",
  "RS",
  "BA",
  "BIH",
  "BE",
  "IT",
  "DE",
  "AT",
  "HU",
  "FR",
  "NL",
  "CZ",
  "SK",
  "PL",
];

function normalizeVatNumber(value: string) {
  const cleaned = value.trim().toUpperCase().replace(/\s+/g, "");

  if (cleaned.startsWith("BIH")) {
    return `BA${cleaned.slice(3)}`;
  }

  return cleaned;
}

function validateVatNumber(value: string) {
  const cleaned = normalizeVatNumber(value);

  if (!cleaned) {
    return {
      valid: false,
      value: cleaned,
      message: "Vnesi davčno številko prejemnika.",
    };
  }

  const matchedPrefix = SUPPORTED_COUNTRY_PREFIXES.find((prefix) =>
    cleaned.startsWith(prefix)
  );

  if (!matchedPrefix) {
    return {
      valid: false,
      value: cleaned,
      message:
        "Davčna številka mora vsebovati predpono države, npr. SI66666666, HR12345678901, BE0123456789, RS123456789, BA123456789, IT12345678901.",
    };
  }

  const numberPart = cleaned.slice(matchedPrefix.length);

  if (numberPart.length < 2 || !/^[A-Z0-9]+$/.test(numberPart)) {
    return {
      valid: false,
      value: cleaned,
      message:
        "Davčna številka ni v pravilni obliki. Začni z oznako države in nato vpiši številko.",
    };
  }

  return {
    valid: true,
    value: cleaned,
    message: "",
  };
}

export default function NewCustomerPage() {
  const [vatNumber, setVatNumber] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast("");
    }, 5000);

    return () => clearTimeout(timer);
  }, [toast]);

  async function searchCustomer() {
    setSearched(true);
    setCustomer(null);
    setMessage("");
    setToast("");
    setHasError(false);

    const validation = validateVatNumber(vatNumber);

    if (!validation.valid) {
      setHasError(true);
      setMessage(validation.message);
      setToast(validation.message);
      return;
    }

    const cleanVat = validation.value;

    setVatNumber(cleanVat);
    setLoading(true);

    try {
      const response = await fetch(
        `/api/bizbox/search-company?vatNumber=${encodeURIComponent(cleanVat)}`
      );

      const data = await response.json();

      if (!data.success) {
        setHasError(true);

        setCustomer({
          name: cleanVat,
          vatNumber: cleanVat,
          status: "NOT_READY",
          eLocation: `C:${cleanVat}`,
          format: "eSLOG 2.0",
        });

        const errorMessage =
          data.message || "Podjetje ni najdeno ali ne prejema e-računov.";

        setMessage(errorMessage);
        setToast(errorMessage);
        return;
      }

      setCustomer(data.customer);
    } catch {
      const errorMessage = "Napaka pri klicu eImenika.";
      setHasError(true);
      setMessage(errorMessage);
      setToast(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  function saveCustomer(favorite = false) {
    if (!customer || customer.status !== "READY") return;

    const existing = JSON.parse(localStorage.getItem("customers") || "[]");

    const updatedCustomer = {
      ...customer,
      isFavorite: favorite,
    };

    const filtered = existing.filter(
      (c: Customer) => c.vatNumber !== updatedCustomer.vatNumber
    );

    localStorage.setItem(
      "customers",
      JSON.stringify([...filtered, updatedCustomer])
    );

    window.location.href = "/customers";
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
            <a href="/invoices/new" className="block rounded-lg px-4 py-3 hover:bg-slate-800">➕ Nov račun</a>
            <a href="/customers" className="block rounded-lg bg-blue-600/20 px-4 py-3 text-blue-200">👥 Stranke</a>
            <a href="/settings" className="block rounded-lg px-4 py-3 hover:bg-slate-800">⚙️ Nastavitve</a>
          </nav>
        </aside>

        <section className="flex-1 p-10">
          <div className="mb-8">
            <a href="/customers" className="text-sm text-blue-300 hover:text-blue-200">
              ← Nazaj na stranke
            </a>

            <h2 className="mt-4 text-4xl font-bold">Poišči stranko v eImeniku</h2>

            <p className="mt-2 text-slate-400">
              Vpiši davčno številko prejemnika z oznako države in preveri, ali prejema e-račune.
            </p>
          </div>

          <div className="max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <label className="mb-2 block text-sm text-slate-300">
              Davčna številka prejemnika
            </label>

            <div className="flex gap-3">
              <input
                value={vatNumber}
                onChange={(event) => {
                  setVatNumber(event.target.value);
                  setHasError(false);
                  setMessage("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    searchCustomer();
                  }
                }}
                className={`flex-1 rounded-lg border bg-slate-800 p-3 outline-none ${
                  hasError
                    ? "border-red-500 focus:border-red-500"
                    : "border-slate-700 focus:border-blue-500"
                }`}
                placeholder="SI66666666, HR12345678901, BE0123456789 ..."
              />

              <button
                onClick={searchCustomer}
                disabled={loading}
                className="rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:opacity-60"
              >
                {loading ? "Iščem..." : "Poišči v eImeniku"}
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Obvezno vpiši oznako države: SI, HR, RS, BA/BIH, BE, IT, DE ...
            </p>

            {message && (
              <div
                className={`mt-5 rounded-lg border p-4 text-sm ${
                  hasError
                    ? "border-red-500/30 bg-red-500/10 text-red-200"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-200"
                }`}
              >
                {message}
              </div>
            )}

            {searched && !customer && !loading && !message && (
              <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-5">
                <div className="text-sm text-red-300">Ni rezultata</div>
              </div>
            )}

            {customer && customer.status === "READY" && (
              <div className="mt-6 rounded-2xl border border-green-500/20 bg-green-500/10 p-5">
                <div className="text-sm text-green-300">Podjetje najdeno v eImeniku</div>

                <h3 className="mt-2 text-2xl font-bold">{customer.name}</h3>

                <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                  <div><span className="text-slate-500">Davčna:</span> {customer.vatNumber}</div>
                  <div><span className="text-slate-500">Status:</span> Prejema e-račune</div>
                  <div><span className="text-slate-500">eLokacija:</span> {customer.eLocation}</div>
                  <div><span className="text-slate-500">Format:</span> {customer.format}</div>
                  <div><span className="text-slate-500">eAddress:</span> {customer.eAddress || "-"}</div>
                  <div><span className="text-slate-500">eAddress1:</span> {customer.eAddress1 || "-"}</div>
                  <div><span className="text-slate-500">Naslov:</span> {customer.address || "-"}</div>
                  <div><span className="text-slate-500">Poštna številka:</span> {customer.postCode || "-"}</div>
                  <div><span className="text-slate-500">Mesto:</span> {customer.city || "-"}</div>
                  <div><span className="text-slate-500">Država:</span> {customer.country || "-"}</div>
                  <div><span className="text-slate-500">Omrežje:</span> {customer.network || "-"}</div>
                  <div><span className="text-slate-500">Prejem:</span> {customer.receiverChannel || "-"}</div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={() => saveCustomer(false)}
                    className="rounded-lg bg-green-600 px-6 py-3 text-center font-semibold hover:bg-green-500"
                  >
                    Shrani v šifrant strank
                  </button>

                  <button
                    onClick={() => saveCustomer(true)}
                    className="rounded-lg border border-yellow-400/30 bg-yellow-500/10 px-6 py-3 text-center font-semibold text-yellow-200 hover:bg-yellow-500/20"
                  >
                    ⭐ Shrani kot priljubljeno
                  </button>
                </div>
              </div>
            )}

            {customer && customer.status === "NOT_READY" && (
              <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
                <div className="text-sm text-amber-300">Podjetje ni pripravljeno</div>

                <h3 className="mt-2 text-xl font-bold">
                  Podjetje trenutno ni potrjeno za prejem izbranega dokumenta
                </h3>

                <p className="mt-3 text-slate-300">
                  Prejemnika nismo našli v eImeniku ali trenutno ne sprejema dokumenta INVOIC v formatu eSLOG 2.0.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}