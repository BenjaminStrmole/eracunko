import type { InvoiceProfile } from "../../../types/invoice";
import type { InvoiceProfileImplementation } from "./types";
import { bankProfile } from "./bank";
import { hrProfile } from "./hr";
import { standardProfile } from "./standard";
import { ujpProfile } from "./ujp";

export const profileImplementations: Record<InvoiceProfile, InvoiceProfileImplementation> = {
  standard: standardProfile,
  hr: hrProfile,
  ujp: ujpProfile,
  bank: bankProfile,
};

export function getInvoiceProfileImplementation(
  profile: InvoiceProfile | undefined
) {
  return profileImplementations[profile || "standard"];
}

export const invoiceProfiles = Object.values(profileImplementations).map(
  (implementation) => implementation.config
);
