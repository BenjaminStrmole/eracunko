export type ClientLocalSentInvoice = {
  number?: string;
  docId?: string;
  status?: string;
  sentAt?: string;
  [key: string]: unknown;
};

export async function saveDbLocalSentInvoice(invoice: ClientLocalSentInvoice) {
  const response = await fetch("/api/local-sent-invoices", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ invoice }),
  });

  if (!response.ok) {
    throw new Error("DB_LOCAL_SENT_SAVE_FAILED");
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.message || "DB_LOCAL_SENT_SAVE_FAILED");
  }

  return data.invoice as ClientLocalSentInvoice;
}
