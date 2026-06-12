import type { Invoice } from "../../../../types/invoice";
import type { ProfileValidationOutput } from "../types";

function isEmpty(valueToCheck: unknown) {
  return String(valueToCheck ?? "").trim() === "";
}

export function validateUjpProfile(invoice: Invoice): ProfileValidationOutput {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ujpData = invoice.ujpData || {};

  if (isEmpty(invoice.references?.orderReference || ujpData.orderReference)) {
    warnings.push("UJP: manjka naročilnica.");
  }

  if (isEmpty(invoice.references?.contractReference || ujpData.contractReference)) {
    warnings.push("UJP: manjka pogodba.");
  }

  if (isEmpty(invoice.references?.buyerReference || ujpData.buyerReference)) {
    warnings.push("UJP: manjka referenca kupca.");
  }

  if (isEmpty(ujpData.budgetUser || ujpData.ujpRecipient)) {
    warnings.push("UJP: priporočljiv je proračunski uporabnik oziroma UJP prejemnik.");
  }

  return { errors, warnings };
}

