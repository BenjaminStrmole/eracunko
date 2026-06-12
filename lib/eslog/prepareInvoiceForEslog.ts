import type { Invoice } from "../../types/invoice";
import { buildEslogInvoiceXml } from "./buildEslogInvoiceXml";
import { validateInvoiceByProfile } from "./invoiceProfiles";
import { normalizeInvoiceForEslog } from "./normalizeInvoice";

export function prepareInvoiceForEslog(invoice: Invoice) {
  const normalizedInvoice = {
    ...normalizeInvoiceForEslog(invoice),
  };
  const validation = validateInvoiceByProfile(normalizedInvoice);
  const xml = validation.valid ? buildEslogInvoiceXml(normalizedInvoice) : "";

  return {
    invoice: {
      ...normalizedInvoice,
      xml,
    },
    validation,
    xml,
  };
}

export function assertPreparedInvoiceForEslog(invoice: Invoice) {
  const prepared = prepareInvoiceForEslog(invoice);

  if (!prepared.validation.valid) {
    throw new Error(prepared.validation.errors.join("\n"));
  }

  return prepared;
}
