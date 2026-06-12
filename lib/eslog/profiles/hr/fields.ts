import type { InvoiceProfileConfig } from "../types";

export const hrFields: InvoiceProfileConfig = {
  id: "hr",
  label: "Hrvaška",
  description: "HR Fiskalizacija 2.0 / HR-CIUS z OIB, operaterjem in KPD.",
  requiredFields: [
    "hrData.issueTime",
    "hrData.businessProcessType",
    "hrData.operatorOib",
    "hrData.operatorCode",
    "line.kpdCode",
    "line.hrVatCategoryCode",
  ],
  optionalFields: ["hrData.previousInvoiceNumber", "hrData.selfBilling"],
  sections: ["base", "buyer", "lines", "payment", "hr"],
};

