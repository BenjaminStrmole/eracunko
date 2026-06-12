import type { InvoiceProfileConfig } from "../types";

export const standardFields: InvoiceProfileConfig = {
  id: "standard",
  label: "Navaden",
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
};

