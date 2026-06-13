"use client";

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
  const [loading, setLoading] = useState(false);

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
    </div>
  );
}
