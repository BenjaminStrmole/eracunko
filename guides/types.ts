import type { DriveStep } from "driver.js";

export type GuideId = "invoice" | "ujp" | "customer" | "xml";

export type GuideDefinition = {
  id: GuideId;
  title: string;
  description: string;
  route: string;
  steps: DriveStep[];
};
