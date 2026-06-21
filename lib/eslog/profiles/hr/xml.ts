import type { Invoice } from "../../../../types/invoice";
import { buildProfileFreeText, insertProfileExtension } from "../xmlHelpers";

export function applyHrXml(xml: string, invoice: Invoice) {
  const hrData = invoice.hrData || {};
  const processType = hrData.businessProcessType || invoice.businessProcess;
  const extensions = [
    buildProfileFreeText("GEN", processType === "P99" ? `P99:${hrData.p99BuyerProcessId || ""}` : undefined),
    buildProfileFreeText("GEN", hrData.selfBilling ? "P12#Samoizdaja" : undefined),
  ]
    .filter(Boolean)
    .join("\n");

  return insertProfileExtension(xml, extensions);
}
