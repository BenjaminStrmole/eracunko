import type { Invoice } from "../../types/invoice";
import { normalizeInvoiceForEslog } from "./normalizeInvoice";
import { validateInvoiceForEslog } from "./validateInvoice";

export function prepareInvoiceForEslog(invoice: Invoice) {
  const normalizedInvoice = normalizeInvoiceForEslog(invoice);
  const validation = validateInvoiceForEslog(normalizedInvoice);

  return {
    invoice: normalizedInvoice,
    validation,
  };
}

export function assertPreparedInvoiceForEslog(invoice: Invoice) {
  const prepared = prepareInvoiceForEslog(invoice);

  if (!prepared.validation.valid) {
    throw new Error(prepared.validation.errors.join("\n"));
  }

  return prepared;
}