import type { Invoice } from "../../../../types/invoice";
import { getProfileFieldIssues } from "../../../onboarding/invoiceFieldRules";
import type { ProfileValidationOutput } from "../types";

export function validateUjpProfile(invoice: Invoice): ProfileValidationOutput {
  const errors = getProfileFieldIssues(invoice, "ujp").map((issue) => issue.message);
  const warnings: string[] = [];
  const ujpData = invoice.ujpData || {};

  if (!String(ujpData.budgetUser || ujpData.ujpRecipient || "").trim()) {
    warnings.push("UJP: priporočljiv je proračunski uporabnik oziroma UJP prejemnik.");
  }

  return { errors, warnings };
}
