import type { InvoiceProfileConfig } from "../types";

export const ujpFields: InvoiceProfileConfig = {
  id: "ujp",
  label: "UJP",
  description: "Javni sektor: obvezen je sklic, koda in namen placila ter vsaj ena referenca dokumenta.",
  requiredFields: [
    "payment.iban",
    "payment.reference",
    "payment.paymentMeansCode",
    "payment.purposeCode",
    "references.orderReference|references.contractReference|references.deliveryNoteReference",
  ],
  optionalFields: ["ujpData.budgetUser", "ujpData.ujpRecipient", "ujpData.publicProcurementReference"],
  sections: ["base", "buyer", "lines", "payment", "ujp"],
  validationRules: ["BT-81", "BT-84", "BT-89", "Purpose code", "Public-sector reference"],
  xmlMappingHints: ["S_PAT", "S_PAI", "S_FII", "RFF PQ", "G_SG1"],
  profileFields: [
    {
      name: "budgetUser",
      label: "Proracunski uporabnik",
      type: "text",
      helper: "Podatek za javni sektor, kadar je znan; kupec mora imeti popolne podatke za UJP posiljanje.",
    },
    {
      name: "ujpRecipient",
      label: "UJP prejemnik",
      type: "text",
      helper: "Naziv ali oznaka UJP prejemnika. Vsaj ena referenca pogodba/narocilo/dobavnica mora biti vpisana v razdelku Reference.",
    },
    {
      name: "publicProcurementReference",
      label: "Referenca javnega narocila",
      type: "text",
      helper: "Dodatna referenca javnega narocila, kadar jo zahteva prejemnik.",
    },
    {
      name: "additionalReference",
      label: "Dodatni UJP sklic",
      type: "text",
      helper: "Ni nadomestilo za placilni sklic. Sklic placila, koda namena in namen placila so v razdelku Placilo.",
    },
  ],
};
