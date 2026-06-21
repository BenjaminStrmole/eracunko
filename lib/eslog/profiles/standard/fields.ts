import type { InvoiceProfileConfig } from "../types";

export const standardFields: InvoiceProfileConfig = {
  id: "standard",
  label: "Standard",
  description: "Minimalni eSLOG 2.0 / EN16931 racun.",
  requiredFields: [
    "number",
    "issueDate",
    "documentType",
    "currency",
    "seller",
    "buyer",
    "lines",
    "vatBreakdown",
    "totals",
  ],
  optionalFields: ["note", "references", "paymentTerms"],
  sections: ["base", "buyer", "lines", "payment"],
  validationRules: ["EN16931 minimum", "Payment data is required for bank transfer"],
  xmlMappingHints: ["S_FTX DOC", "G_SG26", "G_SG50", "G_SG52"],
  profileFields: [],
};
