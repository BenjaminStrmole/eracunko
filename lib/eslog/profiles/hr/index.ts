import type { InvoiceProfileImplementation } from "../types";
import { hrFields } from "./fields";
import { validateHrProfile } from "./validation";
import { applyHrXml } from "./xml";

export const hrProfile: InvoiceProfileImplementation = {
  config: hrFields,
  validate: validateHrProfile,
  applyXml: applyHrXml,
};

