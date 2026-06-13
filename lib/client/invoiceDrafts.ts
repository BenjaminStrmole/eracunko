export type ClientInvoiceDraft = {
  dbId?: string;
  id?: string | number;
  number?: string;
  createdAt?: string;
  updatedAt?: string;
  buyer?: {
    name?: string;
    vat?: string;
  };
  totals?: {
    gross?: number;
    payable?: number;
  };
  status?: string;
  [key: string]: unknown;
};

function safeParseDrafts(value: string | null): ClientInvoiceDraft[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getLocalDrafts() {
  return safeParseDrafts(localStorage.getItem("drafts"));
}

export function setLocalDrafts(drafts: ClientInvoiceDraft[]) {
  localStorage.setItem("drafts", JSON.stringify(drafts));
}

export function prependLocalDraft(draft: ClientInvoiceDraft) {
  const drafts = getLocalDrafts();
  setLocalDrafts([draft, ...drafts]);
}

export async function fetchDbDrafts() {
  const response = await fetch("/api/drafts", {
    cache: "no-store",
  });

  if (!response.ok) return [];

  const data = await response.json();
  return data.success ? (data.drafts as ClientInvoiceDraft[]) : [];
}

export async function saveDbDraft(draft: ClientInvoiceDraft) {
  const response = await fetch(draft.dbId ? `/api/drafts/${draft.dbId}` : "/api/drafts", {
    method: draft.dbId ? "PUT" : "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ draft }),
  });

  if (!response.ok) {
    throw new Error("DB_DRAFT_SAVE_FAILED");
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || "DB_DRAFT_SAVE_FAILED");
  }

  return data.draft as ClientInvoiceDraft;
}

export async function deleteDbDraft(id: string) {
  const response = await fetch(`/api/drafts/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("DB_DRAFT_DELETE_FAILED");
  }
}

export async function loadDraftsWithFallback() {
  const dbDrafts = await fetchDbDrafts().catch(() => []);

  if (dbDrafts.length > 0) {
    setLocalDrafts(dbDrafts);
    return dbDrafts;
  }

  const localDrafts = getLocalDrafts();

  if (localDrafts.length > 0) {
    Promise.allSettled(localDrafts.map((draft) => saveDbDraft(draft))).catch(() => {});
  }

  return localDrafts;
}
