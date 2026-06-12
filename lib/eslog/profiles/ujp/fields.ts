import type { InvoiceProfileConfig } from "../types";

export const ujpFields: InvoiceProfileConfig = {
  id: "ujp",
  label: "UJP",
  description: "Javni sektor z narocilnico, pogodbo in referenco kupca.",
  requiredFields: ["references.orderReference", "references.contractReference", "references.buyerReference"],
  optionalFields: ["ujpData.budgetUser", "ujpData.ujpRecipient", "ujpData.publicProcurementReference"],
  sections: ["base", "buyer", "lines", "payment", "ujp"],
  profileFields: [
    {
      name: "budgetUser",
      label: "Proracunski uporabnik",
      type: "text",
      helper: "Podatek za javni sektor, kadar je znan.",
    },
    {
      name: "ujpRecipient",
      label: "UJP prejemnik",
      type: "text",
      helper: "Naziv ali oznaka UJP prejemnika.",
    },
    {
      name: "publicProcurementReference",
      label: "Referenca javnega narocila",
      type: "text",
    },
    {
      name: "additionalReference",
      label: "Dodatni UJP sklic",
      type: "text",
    },
  ],
};
