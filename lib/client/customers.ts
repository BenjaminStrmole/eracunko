export type ClientCustomer = {
  dbId?: string;
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
  [key: string]: unknown;
};

function safeParseCustomers(value: string | null): ClientCustomer[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getLocalCustomers() {
  return safeParseCustomers(localStorage.getItem("customers"));
}

export function setLocalCustomers(customers: ClientCustomer[]) {
  localStorage.setItem("customers", JSON.stringify(customers));
}

export async function fetchDbCustomers() {
  const response = await fetch("/api/customers", { cache: "no-store" });
  if (!response.ok) return [];

  const data = await response.json();
  return data.success ? (data.customers as ClientCustomer[]) : [];
}

export async function saveDbCustomer(customer: ClientCustomer) {
  const response = await fetch("/api/customers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ customer }),
  });

  if (!response.ok) {
    throw new Error("DB_CUSTOMER_SAVE_FAILED");
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.message || "DB_CUSTOMER_SAVE_FAILED");
  }

  return data.customer as ClientCustomer;
}

export async function deleteDbCustomer(vatNumber: string) {
  const response = await fetch(`/api/customers/${encodeURIComponent(vatNumber)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("DB_CUSTOMER_DELETE_FAILED");
  }
}

export async function loadCustomersWithFallback() {
  const dbCustomers = await fetchDbCustomers().catch(() => []);

  if (dbCustomers.length > 0) {
    setLocalCustomers(dbCustomers);
    return dbCustomers;
  }

  const localCustomers = getLocalCustomers();
  if (localCustomers.length > 0) {
    Promise.allSettled(localCustomers.map((customer) => saveDbCustomer(customer))).catch(() => {});
  }

  return localCustomers;
}
