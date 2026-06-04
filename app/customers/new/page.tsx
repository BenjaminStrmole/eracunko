"use client";

import { useEffect, useMemo, useState } from "react";

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

type Suggestion = {
  name: string;
  vatNumber: string;
  eLocation: string;
};

const SUPPORTED_COUNTRY_PREFIXES = [
  "SI", "HR", "RS", "BA", "BIH", "BE", "IT", "DE", "AT", "HU", "FR", "NL", "CZ", "SK", "PL",
];

function normalizeSearchValue(value: string) {
  const cleaned = value.trim().toUpperCase().replace(/\s+/g, "");
  if (cleaned.startsWith("BIH")) return `BA${cleaned.slice(3)}`;
  return cleaned;
}

function looksLikeVat(value: string) {
  const cleaned = normalizeSearchValue(value);
  return SUPPORTED_COUNTRY_PREFIXES.some((prefix) => cleaned.startsWith(prefix));
}

function validateVatNumber(value: string) {
  const cleaned = normalizeSearchValue(value);
  if (!cleaned) return { valid: false, value: cleaned, message: "Vnesi davčno številko ali naziv podjetja." };

  const matchedPrefix = SUPPORTED_COUNTRY_PREFIXES.find((prefix) => cleaned.startsWith(prefix));
  if (!matchedPrefix) {
    return {
      valid: false,
      value: cleaned,
      message: "Za direktno iskanje po davčni mora biti dodana oznaka države, npr. SI66666666.",
    };
  }

  const numberPart = cleaned.slice(matchedPrefix.length);
  if (numberPart.length < 2 || !/^[A-Z0-9]+$/.test(numberPart)) {
    return {
      valid: false,
      value: cleaned,
      message: "Davčna številka ni v pravilni obliki.",
    };
  }

  return { valid: true, value: cleaned, message: "" };
}

export default function NewCustomerPage() {
  const [query, setQuery] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsFinished, setSuggestionsFinished] = useState(false);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const [hasError, setHasError] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const trimmedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const value = trimmedQuery;

    setCustomer(null);
    setMessage("");
    setHasError(false);
    setSuggestionsFinished(false);

    if (value.length < 3 || looksLikeVat(value)) {
      setSuggestions([]);
      setDropdownOpen(false);
      setSuggestionsLoading(false);
      return;
    }

    setDropdownOpen(true);
    setSuggestionsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/bizbox/search-companies?filter=${encodeURIComponent(value)}`
        );

        const data = await response.json();

        if (!data.success) {
          setSuggestions([]);
          return;
        }

        setSuggestions(data.companies || []);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
        setSuggestionsFinished(true);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [trimmedQuery]);

  async function searchCustomerByVat(vatValue: string) {
    const validation = validateVatNumber(vatValue);

    if (!validation.valid) {
      setHasError(true);
      setMessage(validation.message);
      setToast(validation.message);
      return;
    }

    const cleanVat = validation.value;

    setQuery(cleanVat);
    setSearched(true);
    setCustomer(null);
    setMessage("");
    setToast("");
    setHasError(false);
    setDropdownOpen(false);
    setLoading(true);

    try {
      const response = await fetch(
        `/api/bizbox/search-company?vatNumber=${encodeURIComponent(cleanVat)}`
      );

      const data = await response.json();

      if (!data.success) {
        const errorMessage =
          data.message || "Podjetje ni najdeno ali ne prejema e-računov.";

        setHasError(true);
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

  async function handleSearch() {
    const value = trimmedQuery;

    if (!value) {
      const errorMessage = "Vnesi davčno številko ali naziv podjetja.";
      setHasError(true);
      setMessage(errorMessage);
      setToast(errorMessage);
      return;
    }

    if (looksLikeVat(value)) {
      await searchCustomerByVat(value);
      return;
    }

    if (value.length < 3) {
      const errorMessage =
        "Za iskanje po nazivu vpiši vsaj 3 znake ali vpiši davčno z oznako države.";
      setHasError(true);
      setMessage(errorMessage);
      setToast(errorMessage);
      return;
    }

    setDropdownOpen(true);

    if (!suggestionsLoading && suggestionsFinished && suggestions.length === 0) {
      const errorMessage = "Ni predlogov. Poskusi z daljšim nazivom ali davčno številko.";
      setMessage(errorMessage);
      setToast(errorMessage);
    }
  }

  async function selectSuggestion(suggestion: Suggestion) {
    setDropdownOpen(false);
    setSuggestions([]);
    setSuggestionsFinished(false);

    const vat = suggestion.vatNumber || suggestion.eLocation.replace("C:", "");
    setQuery(vat);

    await searchCustomerByVat(vat);
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
              Vpiši davčno številko ali začni tipkati naziv podjetja. Predlogi se prikažejo samodejno.
            </p>
          </div>

          <div className="max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <label className="mb-2 block text-sm text-slate-300">
              Davčna številka ali naziv podjetja
            </label>

            <div className="relative">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setHasError(false);
                      setMessage("");
                    }}
                    onFocus={() => {
                      if (suggestions.length > 0 || suggestionsLoading) {
                        setDropdownOpen(true);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleSearch();
                      if (event.key === "Escape") setDropdownOpen(false);
                    }}
                    className={`w-full rounded-lg border bg-slate-800 p-3 pr-11 outline-none ${
                      hasError
                        ? "border-red-500 focus:border-red-500"
                        : "border-slate-700 focus:border-blue-500"
                    }`}
                    placeholder="SI66666666 ali Petrol, DARS, ZZI ..."
                  />

                  {(suggestionsLoading || loading) && (
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-500 border-t-blue-400" />
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:opacity-60"
                >
                  {loading ? "Iščem..." : "Išči"}
                </button>
              </div>

              {dropdownOpen && (
                <div className="absolute left-0 right-28 top-14 z-40 overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl">
                  {suggestionsLoading && (
                    <div className="flex items-center gap-3 px-4 py-4 text-sm text-slate-400">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-500 border-t-blue-400" />
                      Iščem ustrezna podjetja ...
                    </div>
                  )}

                  {!suggestionsLoading && suggestionsFinished && suggestions.length === 0 && (
                    <div className="px-4 py-4 text-sm text-slate-400">
                      Ni predlogov za ta vnos.
                    </div>
                  )}

                  {!suggestionsLoading &&
                    suggestions.map((suggestion) => (
                      <button
                        key={`${suggestion.eLocation}-${suggestion.name}`}
                        onClick={() => selectSuggestion(suggestion)}
                        className="block w-full border-b border-slate-800 px-4 py-4 text-left last:border-b-0 hover:bg-slate-800"
                      >
                        <div className="font-semibold text-white">
                          {suggestion.name || "Brez naziva"}
                        </div>

                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
                          <span>{suggestion.vatNumber || "-"}</span>
                          <span>{suggestion.eLocation || "-"}</span>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Za direktno iskanje po davčni uporabi oznako države: SI, HR, RS, BA/BIH, BE, IT, DE ...
            </p>

            {message && !suggestionsLoading && !loading && (
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