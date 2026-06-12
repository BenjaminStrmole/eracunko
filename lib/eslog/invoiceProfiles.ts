import type { Invoice, InvoiceProfile } from "../../types/invoice";
import { getInvoiceProfileImplementation, invoiceProfiles, profileImplementations } from "./profiles/registry";
import type { InvoiceProfileConfig } from "./profiles/types";
import { validateInvoiceForEslog } from "./validateInvoice";

export type { InvoiceProfileConfig };

export type ProfileValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  profile: InvoiceProfile;
};

export const invoiceProfileConfigs = Object.fromEntries(
  invoiceProfiles.map((profile) => [profile.id, profile])
) as Record<InvoiceProfile, InvoiceProfileConfig>;

export { getInvoiceProfileImplementation, invoiceProfiles, profileImplementations };

export function validateInvoiceByProfile(invoice: Invoice): ProfileValidationResult {
  const base = validateInvoiceForEslog(invoice);
  const profileImplementation = getInvoiceProfileImplementation(invoice.profile);
  const profileResult = profileImplementation.validate(invoice);
  const errors = [...base.errors, ...profileResult.errors];
  const warnings = [...base.warnings, ...profileResult.warnings];

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    profile: profileImplementation.config.id,
  };
}
