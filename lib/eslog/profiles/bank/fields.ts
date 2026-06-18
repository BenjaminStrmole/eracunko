import type { InvoiceProfileConfig } from "../types";

export const bankFields: InvoiceProfileConfig = {
  id: "bank",
  label: "Banka",
  description: "Placilni profil z IBAN, BIC/SWIFT, sklicem, kodo namena, namenom placila in vsaj eno referenco.",
  requiredFields: [
    "payment.iban",
    "payment.bic",
    "payment.reference",
    "payment.paymentMeansCode",
    "payment.purposeCode",
    "bankData.paymentModel",
    "references.orderReference|references.contractReference|references.deliveryNoteReference",
  ],
  optionalFields: ["bankData.payerName", "bankData.payeeName"],
  sections: ["base", "buyer", "lines", "payment", "bank"],
  profileFields: [
    {
      name: "paymentModel",
      label: "Model placila",
      type: "text",
      required: true,
      helper: "Model je locen od sklica placila. Sklic placila je obvezno polje v razdelku Placilo.",
      placeholder: "npr. SI00 ali HR00",
    },
    {
      name: "payerName",
      label: "Naziv placnika",
      type: "text",
      helper: "Podatek placnika za placilni profil, kadar ga banka zahteva.",
    },
    {
      name: "payeeName",
      label: "Naziv prejemnika",
      type: "text",
      helper: "Prejemnik placila. IBAN in BIC/SWIFT sta podatka placilnega racuna v razdelku Placilo.",
    },
  ],
};
