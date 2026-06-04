"use client";

import { useEffect, useState } from "react";

export type ActiveCompany = {
  name: string;
  taxId: string;
  locationName: string;
  locationId: string;
  eLocation: string;
  eAddress: string;
  address?: string;
  canSendInvoices?: boolean;
};

export default function CompanySelector() {
  const [companies, setCompanies] = useState<ActiveCompany[]>([]);
  const [activeCompany, setActiveCompany] = useState<ActiveCompany | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("activeCompany");

    if (saved) {
      setActiveCompany(JSON.parse(saved));
    }

    loadCompanies();
  }, []);

  async function loadCompanies() {
    setLoading(true);

    try {
      const response = await fetch("/api/bizbox/my-companies");
      const data = await response.json();

      if (!data.success) return;

      setCompanies(data.companies || []);

      const saved = localStorage.getItem("activeCompany");

      if (!saved && data.companies?.length > 0) {
        const firstSender =
          data.companies.find((company: ActiveCompany) => company.canSendInvoices) ||
          data.companies[0];

        localStorage.setItem("activeCompany", JSON.stringify(firstSender));
        setActiveCompany(firstSender);
      }
    } finally {
      setLoading(false);
    }
  }

  function selectCompany(value: string) {
    const selected = companies.find(
      (company) => `${company.taxId}-${company.locationId}` === value
    );

    if (!selected) return;

    localStorage.setItem("activeCompany", JSON.stringify(selected));
    setActiveCompany(selected);
  }

  return (
    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5">
      <div className="mb-3">
        <div className="text-sm text-blue-200">Aktivno podjetje</div>
        <div className="mt-1 font-bold">
          {activeCompany
            ? `${activeCompany.name} (${activeCompany.taxId})`
            : loading
            ? "Nalagam podjetja ..."
            : "Ni izbranega podjetja"}
        </div>
        {activeCompany && (
          <div className="mt-1 text-xs text-slate-400">
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
        className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm outline-none focus:border-blue-500"
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