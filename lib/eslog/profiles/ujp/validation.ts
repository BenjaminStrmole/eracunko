import type { Invoice } from "../../../../types/invoice";
import type { ProfileValidationOutput } from "../types";

function isEmpty(valueToCheck: unknown) {
  return String(valueToCheck ?? "").trim() === "";
}

export function validateUjpProfile(invoice: Invoice): ProfileValidationOutput {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ujpData = invoice.ujpData || {};
  const hasReference = !isEmpty(
    invoice.references?.orderReference ||
      ujpData.orderReference ||
      invoice.references?.contractReference ||
      ujpData.contractReference ||
      invoice.references?.deliveryNoteReference ||
      ujpData.deliveryNoteReference
  );

  if (!hasReference) {
    errors.push("UJP: manjka vsaj en referenčni dokument: pogodba, naročilo ali dobavnica.");
  }

  if (isEmpty(ujpData.budgetUser || ujpData.ujpRecipient)) {
    warnings.push("UJP: priporočljiv je proračunski uporabnik oziroma UJP prejemnik.");
  }

  return { errors, warnings };
}
