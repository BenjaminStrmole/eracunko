import type { InvoiceProfileConfig } from "../types";

export const bankFields: InvoiceProfileConfig = {
  id: "bank",
  label: "Banka",
  description: "Placilni profil z obveznim IBAN/BIC/sklicem in kodo namena.",
  requiredFields: ["payment.iban", "payment.bic", "payment.reference", "payment.paymentMeansCode", "payment.purposeCode"],
  optionalFields: ["bankData.payerName", "bankData.payeeName"],
  sections: ["base", "buyer", "lines", "payment", "bank"],
  profileFields: [
    {
      name: "paymentModel",
      label: "Model/sklic",
      type: "text",
      required: true,
      placeholder: "npr. SI00 ali HR00",
    },
    {
      name: "payerName",
      label: "Naziv placnika",
      type: "text",
    },
    {
      name: "payeeName",
      label: "Naziv prejemnika",
      type: "text",
    },
  ],
};
