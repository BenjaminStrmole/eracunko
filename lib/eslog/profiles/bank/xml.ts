import type { Invoice } from "../../../../types/invoice";
import { buildProfileFreeText, insertProfileExtension } from "../xmlHelpers";

export function applyBankXml(xml: string, invoice: Invoice) {
  const bankData = invoice.bankData || {};
  const extensions = [
    buildProfileFreeText("PMT", bankData.paymentModel ? `${bankData.paymentModel}#Model plačila` : undefined),
    buildProfileFreeText("PMT", bankData.payerName ? `${bankData.payerName}#Plačnik` : undefined),
    buildProfileFreeText("PMT", bankData.payeeName ? `${bankData.payeeName}#Prejemnik plačila` : undefined),
  ]
    .filter(Boolean)
    .join("\n");

  return insertProfileExtension(xml, extensions);
}

