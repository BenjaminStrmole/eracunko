"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  activeCompanyKey,
  fetchDbActiveCompany,
  getStoredActiveCompany,
  storeActiveCompany,
  syncDbActiveCompany,
  type ClientActiveCompany,
} from "../../lib/client/activeCompany";

export type ActiveCompany = ClientActiveCompany & {
  name: string;
  taxId: string;
  locationName: string;
  locationId: string;
  eLocation: string;
  eAddress: string;
  address?: string;
  postCode?: string;
  city?: string;
  country?: string;
  canSendInvoices?: boolean;
};

export default function CompanySelector() {
  const [companies, setCompanies] = useState<ActiveCompany[]>([]);
  const [activeCompany, setActiveCompany] = useState<ActiveCompany | null>(null);
  const [companyComplete, setCompanyComplete] = useState(true);
  const [loading, setLoading] = useState(false);

  async function refreshCompanyCompleteness() {
    try {
      const response = await fetch("/api/settings/company", { cache: "no-store" });
      const data = await response.json();
      setCompanyComplete(Boolean(data.company?.completeForEslog));
    } catch {
      setCompanyComplete(true);
    }
  }

  async function loadCompanies() {
    setLoading(true);

    try {
      const localCompany = getStoredActiveCompany() as ActiveCompany | null;

      if (localCompany) {
        setActiveCompany(localCompany);
        syncDbActiveCompany(localCompany).catch(() => {});
      }

      const [dbCompany, companiesResponse] = await Promise.all([
        localCompany ? Promise.resolve(null) : fetchDbActiveCompany().catch(() => null),
        fetch("/api/bizbox/my-companies"),
      ]);
      const data = await companiesResponse.json();

      if (dbCompany) {
        storeActiveCompany(dbCompany);
        setActiveCompany(dbCompany as ActiveCompany);

        if (activeCompanyKey(dbCompany) !== activeCompanyKey(localCompany)) {
          window.dispatchEvent(new CustomEvent("active-company-changed"));
        }
      }

      if (!data.success) return;

      setCompanies(data.companies || []);

      if (!dbCompany && !localCompany && data.companies?.length > 0) {
        const firstSender =
          data.companies.find((company: ActiveCompany) => company.canSendInvoices) ||
          data.companies[0];

        storeActiveCompany(firstSender);
        setActiveCompany(firstSender);
        window.dispatchEvent(new CustomEvent("active-company-changed"));
        syncDbActiveCompany(firstSender).catch(() => {});
      }
    } finally {
      refreshCompanyCompleteness();
      setLoading(false);
    }
  }

  useEffect(() => {
    const saved = getStoredActiveCompany() as ActiveCompany | null;

    queueMicrotask(() => {
      if (saved) {
        setActiveCompany(saved);
      }

      loadCompanies();
    });

    const listener = () => refreshCompanyCompleteness();
    window.addEventListener("active-company-changed", listener);
    return () => window.removeEventListener("active-company-changed", listener);
  }, []);

  async function selectCompany(value: string) {
    const selected = companies.find(
      (company) => `${company.taxId}-${company.locationId}` === value
    );

    if (!selected) return;

    storeActiveCompany(selected);
    window.dispatchEvent(new CustomEvent("active-company-changed"));
    setActiveCompany(selected);
    syncDbActiveCompany(selected).catch(() => {});
    refreshCompanyCompleteness();
  }

  return (
    <div className="glass-panel rounded-[1.5rem] p-5">
      <div className="mb-3">
        <div className="text-sm font-medium text-[var(--app-primary-strong)]">
          Aktivno podjetje
        </div>
        <div className="mt-1 font-bold">
          {activeCompany
            ? `${activeCompany.name} (${activeCompany.taxId})`
            : loading
            ? "Nalagam podjetja ..."
            : "Ni izbranega podjetja"}
        </div>
        {activeCompany && (
          <div className="app-muted mt-1 text-xs">
            {activeCompany.eAddress} · {activeCompany.eLocation}
          </div>
        )}
      </div>

      <select
        value={
          activeCompany
            ? `${activeCompany.taxId}-${activeCompany.locationId}`
            : ""
        }
        onChange={(event) => selectCompany(event.target.value)}
        className="field-input text-sm"
      >
        <option value="">Izberi podjetje</option>

        {companies.map((company) => (
          <option
            key={`${company.taxId}-${company.locationId}`}
            value={`${company.taxId}-${company.locationId}`}
          >
            {company.name} — {company.taxId} — {company.locationName}
          </option>
        ))}
      </select>

      {activeCompany && !companyComplete && (
        <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-300">
          <div className="font-semibold">
            Podatki podjetja niso popolni za pošiljanje e-računov.
          </div>
          <Link href="/settings" className="mt-2 inline-flex font-semibold underline-offset-4 hover:underline">
            Dopolni podatke podjetja
          </Link>
        </div>
      )}
    </div>
  );
}
