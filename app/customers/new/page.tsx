"use client";

import { Search, Star, UserCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import { useToast } from "../../components/ToastProvider";

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
  if (!cleaned) {
    return {
      valid: false,
      value: cleaned,
      message: "Vnesi davčno številko ali naziv podjetja.",
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
        "Za direktno iskanje po davčni mora biti dodana oznaka države, npr. SI66666666.",
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
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsFinished, setSuggestionsFinished] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const trimmedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    const value = trimmedQuery;

    queueMicrotask(() => {
      setCustomer(null);
      setMessage("");
      setHasError(false);
      setSuggestionsFinished(false);
    });

    if (value.length < 3 || looksLikeVat(value)) {
      queueMicrotask(() => {
        setSuggestions([]);
        setDropdownOpen(false);
        setSuggestionsLoading(false);
      });
      return;
    }

    queueMicrotask(() => {
      setDropdownOpen(true);
      setSuggestionsLoading(true);
    });

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/bizbox/search-companies?filter=${encodeURIComponent(value)}`
        );
        const data = await response.json();

        if (!data.success) {
          setSuggestions([]);
          toast.error(
            "Predlogov ni bilo mogoče naložiti",
            data.message || "Napaka pri iskanju podjetij."
          );
          return;
        }

        setSuggestions(data.companies || []);
      } catch (error) {
        setSuggestions([]);
        toast.error(
          "Predlogov ni bilo mogoče naložiti",
          error instanceof Error ? error.message : "Napaka pri iskanju podjetij."
        );
      } finally {
        setSuggestionsLoading(false);
        setSuggestionsFinished(true);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [trimmedQuery, toast]);

  async function searchCustomerByVat(vatValue: string) {
    const validation = validateVatNumber(vatValue);

    if (!validation.valid) {
      setHasError(true);
      setMessage(validation.message);
      toast.warning("Preveri iskanje", validation.message);
      return;
    }

    const cleanVat = validation.value;

    setQuery(cleanVat);
    setSearched(true);
    setCustomer(null);
    setMessage("");
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
        toast.error("Iskanje ni uspelo", errorMessage);
        return;
      }

      setCustomer(data.customer);
    } catch {
      const errorMessage = "Napaka pri klicu eImenika.";
      setHasError(true);
      setMessage(errorMessage);
      toast.error("Iskanje ni uspelo", errorMessage);
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
      toast.warning("Manjka iskalni niz", errorMessage);
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
      toast.warning("Prekratek iskalni niz", errorMessage);
      return;
    }

    setDropdownOpen(true);

    if (!suggestionsLoading && suggestionsFinished && suggestions.length === 0) {
      const errorMessage =
        "Ni predlogov. Poskusi z daljšim nazivom ali davčno številko.";
      setMessage(errorMessage);
      toast.info("Ni predlogov", errorMessage);
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
    <AppShell>
      <div className="mb-8">
        <Link
          href="/customers"
          className="text-sm font-semibold text-[var(--app-primary-strong)]"
        >
          Nazaj na stranke
        </Link>
        <div className="status-pill mt-5 mb-4 inline-flex">eImenik</div>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          Poišči stranko
        </h1>
        <p className="app-muted mt-3 max-w-2xl">
          Vpiši davčno številko ali naziv podjetja. Predlogi se prikažejo
          samodejno, stranko pa lahko shraniš v šifrant.
        </p>
      </div>

      <section className="solid-panel max-w-5xl rounded-[1.75rem] p-6">
        <label className="app-muted mb-2 block text-sm font-medium">
          Davčna številka ali naziv podjetja
        </label>

        <div className="relative">
          <div className="flex gap-3">
            <div className="relative flex-1">
              {!query && (
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 app-muted"
                  aria-hidden="true"
                />
              )}
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
                className={`field-input field-input-with-right-action ${
                  query ? "" : "field-input-with-left-icon"
                } ${
                  hasError ? "border-red-500" : ""
                }`}
                placeholder="SI66666666 ali Petrol, DARS, ZZI ..."
              />

              {(suggestionsLoading || loading) && (
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--app-border)] border-t-[var(--app-primary)]" />
                </div>
              )}
            </div>

            <button
              onClick={handleSearch}
              disabled={loading}
              className="primary-button h-12 px-6 disabled:opacity-60"
            >
              {loading ? "Iščem..." : "Išči"}
            </button>
          </div>

          {dropdownOpen && (
            <div className="absolute left-0 right-0 top-14 z-50 max-h-[min(420px,70vh)] overflow-y-auto rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-strong)] shadow-[var(--app-shadow)] sm:right-28">
              {suggestionsLoading && (
                <div className="app-muted flex items-center gap-3 px-4 py-4 text-sm">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--app-border)] border-t-[var(--app-primary)]" />
                  Iščem ustrezna podjetja ...
                </div>
              )}

              {!suggestionsLoading &&
                suggestionsFinished &&
                suggestions.length === 0 && (
                  <div className="app-muted px-4 py-4 text-sm">
                    Ni predlogov za ta vnos.
                  </div>
                )}

              {!suggestionsLoading &&
                suggestions.map((suggestion) => (
                  <button
                    key={`${suggestion.eLocation}-${suggestion.name}`}
                    onClick={() => selectSuggestion(suggestion)}
                    className="block w-full border-b border-[var(--app-border)] px-4 py-4 text-left last:border-b-0 hover:bg-[var(--app-soft)]"
                  >
                    <div className="font-semibold">
                      {suggestion.name || "Brez naziva"}
                    </div>
                    <div className="app-muted mt-1 flex flex-wrap gap-3 text-xs">
                      <span>{suggestion.vatNumber || "-"}</span>
                      <span>{suggestion.eLocation || "-"}</span>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>

        <p className="app-muted mt-2 text-xs">
          Za direktno iskanje po davčni uporabi oznako države: SI, HR, RS,
          BA/BIH, BE, IT, DE ...
        </p>

        {message && !suggestionsLoading && !loading && (
          <div
            className={`mt-5 rounded-2xl border p-4 text-sm ${
              hasError
                ? "border-red-500/30 bg-red-500/10 text-red-500"
                : "border-amber-500/30 bg-amber-500/10 text-amber-500"
            }`}
          >
            {message}
          </div>
        )}

        {searched && !customer && !loading && !message && (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-500">
            Ni rezultata.
          </div>
        )}

        {customer && customer.status === "READY" && (
          <div className="mt-6 rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/10 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-500">
              <UserCheck className="h-4 w-4" aria-hidden="true" />
              Podjetje najdeno v eImeniku
            </div>

            <h2 className="mt-2 text-2xl font-semibold">{customer.name}</h2>

            <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <Info label="Davčna" value={customer.vatNumber} />
              <Info label="Status" value="Prejema e-račune" />
              <Info label="eLokacija" value={customer.eLocation} />
              <Info label="Format" value={customer.format} />
              <Info label="eAddress" value={customer.eAddress || "-"} />
              <Info label="eAddress1" value={customer.eAddress1 || "-"} />
              <Info label="Naslov" value={customer.address || "-"} />
              <Info label="Poštna številka" value={customer.postCode || "-"} />
              <Info label="Mesto" value={customer.city || "-"} />
              <Info label="Država" value={customer.country || "-"} />
              <Info label="Omrežje" value={customer.network || "-"} />
              <Info label="Prejem" value={customer.receiverChannel || "-"} />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => saveCustomer(false)}
                className="primary-button h-12 px-6"
              >
                Shrani v šifrant strank
              </button>

              <button
                onClick={() => saveCustomer(true)}
                className="secondary-button h-12 px-6"
              >
                <Star className="h-4 w-4" aria-hidden="true" />
                Shrani kot priljubljeno
              </button>
            </div>
          </div>
        )}

        {customer && customer.status === "NOT_READY" && (
          <div className="mt-6 rounded-[1.5rem] border border-amber-500/20 bg-amber-500/10 p-5">
            <div className="text-sm font-semibold text-amber-500">
              Podjetje ni pripravljeno
            </div>
            <h2 className="mt-2 text-xl font-semibold">
              Podjetje trenutno ni potrjeno za prejem izbranega dokumenta.
            </h2>
            <p className="app-muted mt-3">
              Prejemnika nismo našli v eImeniku ali trenutno ne sprejema
              dokumenta INVOIC v formatu eSLOG 2.0.
            </p>
          </div>
        )}
      </section>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
      <span className="app-muted">{label}:</span> {value || "-"}
    </div>
  );
}
