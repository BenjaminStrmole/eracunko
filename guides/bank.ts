import type { GuideDefinition } from "./types";

export const bankGuide: GuideDefinition = {
  id: "bank",
  title: "Bančni profil računa",
  description: "Interaktivni vnos IBAN, BIC, modela plačila in referenc.",
  route: "/invoices/new",
  mode: "field-wizard",
  flow: "bank",
  steps: [],
};
