import type { InvoiceProfileConfig } from "../types";

export const ujpFields: InvoiceProfileConfig = {
  id: "ujp",
  label: "UJP",
  description: "Javni sektor z narocilnico, pogodbo in referenco kupca.",
  requiredFields: ["references.orderReference", "references.contractReference", "references.buyerReference"],
  optionalFields: ["ujpData.budgetUser", "ujpData.ujpRecipient", "ujpData.publicProcurementReference"],
  sections: ["base", "buyer", "lines", "payment", "ujp"],
};

