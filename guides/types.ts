import type { DriveStep } from "driver.js";
import type { InvoiceFieldWizardFlow } from "../lib/onboarding/types";

export type GuideId = "invoice" | "ujp" | "hr" | "bank" | "customer" | "xml";

export type GuideDefinition = {
  id: GuideId;
  title: string;
  description: string;
  route: string;
  steps: DriveStep[];
  mode?: "tour" | "field-wizard";
  flow?: InvoiceFieldWizardFlow;
};
