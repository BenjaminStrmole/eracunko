import type { Invoice } from "../../../../types/invoice";
import { getProfileFieldIssues } from "../../../onboarding/invoiceFieldRules";
import type { ProfileValidationOutput } from "../types";

function value(valueToCheck: unknown) {
  return String(valueToCheck ?? "").trim();
}

function isEmpty(valueToCheck: unknown) {
  return value(valueToCheck) === "";
}

export function validateBankProfile(invoice: Invoice): ProfileValidationOutput {
  const errors = getProfileFieldIssues(invoice, "bank").map((issue) => issue.message);
  const warnings: string[] = [];
  const bankData = invoice.bankData || {};

  if (isEmpty(bankData.payerName)) {
    warnings.push("Banka: priporočljiv je naziv plačnika.");
  }

  if (isEmpty(bankData.payeeName)) {
    warnings.push("Banka: priporočljiv je naziv prejemnika plačila.");
  }

  return { errors, warnings };
}
