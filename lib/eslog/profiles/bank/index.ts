import type { InvoiceProfileImplementation } from "../types";
import { bankFields } from "./fields";
import { validateBankProfile } from "./validation";
import { applyBankXml } from "./xml";

export const bankProfile: InvoiceProfileImplementation = {
  config: bankFields,
  validate: validateBankProfile,
  applyXml: applyBankXml,
};

