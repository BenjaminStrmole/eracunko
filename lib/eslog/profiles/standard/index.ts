import type { InvoiceProfileImplementation } from "../types";
import { standardFields } from "./fields";
import { validateStandardProfile } from "./validation";
import { applyStandardXml } from "./xml";

export const standardProfile: InvoiceProfileImplementation = {
  config: standardFields,
  validate: validateStandardProfile,
  applyXml: applyStandardXml,
};

