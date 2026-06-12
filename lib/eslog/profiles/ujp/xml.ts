import type { Invoice } from "../../../../types/invoice";
import { buildProfileFreeText, insertProfileExtension } from "../xmlHelpers";

export function applyUjpXml(xml: string, invoice: Invoice) {
  const ujpData = invoice.ujpData || {};
  const extensions = [
    buildProfileFreeText("GEN", ujpData.budgetUser ? `${ujpData.budgetUser}#Proračunski uporabnik` : undefined),
    buildProfileFreeText("GEN", ujpData.ujpRecipient ? `${ujpData.ujpRecipient}#UJP prejemnik` : undefined),
    buildProfileFreeText(
      "GEN",
      ujpData.publicProcurementReference
        ? `${ujpData.publicProcurementReference}#Javno naročilo`
        : undefined
    ),
    buildProfileFreeText(
      "GEN",
      ujpData.additionalReference ? `${ujpData.additionalReference}#Dodatni sklic` : undefined
    ),
  ]
    .filter(Boolean)
    .join("\n");

  return insertProfileExtension(xml, extensions);
}

