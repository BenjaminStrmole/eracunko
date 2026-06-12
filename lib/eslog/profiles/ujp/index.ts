import type { InvoiceProfileImplementation } from "../types";
import { ujpFields } from "./fields";
import { validateUjpProfile } from "./validation";
import { applyUjpXml } from "./xml";

export const ujpProfile: InvoiceProfileImplementation = {
  config: ujpFields,
  validate: validateUjpProfile,
  applyXml: applyUjpXml,
};

