export type ClientActiveCompany = {
  name?: string;
  taxId?: string;
  vatNumber?: string;
  locationName?: string;
  locationId?: string;
  eLocation?: string;
  eAddress?: string;
  address?: string;
  postCode?: string;
  city?: string;
  country?: string;
  canSendInvoices?: boolean;
};

export function parseStoredActiveCompany(value: string | null) {
  if (!value) return null;

  try {
    return JSON.parse(value) as ClientActiveCompany;
  } catch {
    return null;
  }
}

export function getStoredActiveCompany() {
  return parseStoredActiveCompany(localStorage.getItem("activeCompany"));
}

export function storeActiveCompany(company: ClientActiveCompany | null) {
  if (!company) {
    localStorage.removeItem("activeCompany");
    return;
  }

  localStorage.setItem("activeCompany", JSON.stringify(company));
}

export async function fetchDbActiveCompany() {
  const response = await fetch("/api/settings/active-company", {
    cache: "no-store",
  });

  if (!response.ok) return null;

  const data = await response.json();
  return data.success ? (data.activeCompany as ClientActiveCompany | null) : null;
}

export async function syncDbActiveCompany(company: ClientActiveCompany | null) {
  await fetch("/api/settings/active-company", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ activeCompany: company }),
  });
}

export async function loadActiveCompanyWithFallback() {
  const localCompany = getStoredActiveCompany();

  try {
    const dbCompany = await fetchDbActiveCompany();

    if (dbCompany) {
      storeActiveCompany(dbCompany);
      return dbCompany;
    }
  } catch {}

  if (localCompany) {
    syncDbActiveCompany(localCompany).catch(() => {});
  }

  return localCompany;
}
