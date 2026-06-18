import type { GuideDefinition } from "./types";

export const hrGuide: GuideDefinition = {
  id: "hr",
  title: "Hrvaški e-račun",
  description: "Interaktivni vnos OIB, operaterja, KPD/CPA in HR DDV podatkov.",
  route: "/invoices/new",
  mode: "field-wizard",
  flow: "hr",
  steps: [],
};
