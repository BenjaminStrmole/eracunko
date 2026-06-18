import type { Invoice } from "../../../../types/invoice";
import { getProfileFieldIssues } from "../../../onboarding/invoiceFieldRules";
import type { ProfileValidationOutput } from "../types";

export function validateHrProfile(invoice: Invoice): ProfileValidationOutput {
  const errors = getProfileFieldIssues(invoice, "hr").map((issue) => issue.message);
  const warnings: string[] = [];
  const hrData = invoice.hrData || {};
  const invoiceNumber =
    invoice.number ||
    [
      hrData.invoiceNumberNumericPart || invoice.invoiceNumberNumericPart,
      hrData.businessPremiseCode || invoice.businessPremiseCode,
      hrData.deviceCode || invoice.deviceCode,
    ]
      .filter(Boolean)
      .join("-");

  if (!/^\S+[-_/]\S+[-_/]\S+$/.test(invoiceNumber)) {
    errors.push("HR: številka računa mora imeti tri dele brez presledkov.");
  }

  return { errors, warnings };
}
