import type { Invoice } from "../../types/invoice";
import { buildEslogInvoiceXml } from "./buildEslogInvoiceXml";
import { normalizeInvoiceForEslog } from "./normalizeInvoice";
import { validateInvoiceForEslog } from "./validateInvoice";

export function prepareInvoiceForEslog(invoice: Invoice) {
  const normalizedInvoice = {
    ...normalizeInvoiceForEslog(invoice),
  };
  const validation = validateInvoiceForEslog(normalizedInvoice);
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
