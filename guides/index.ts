import { bankGuide } from "./bank";
import { customerGuide } from "./customer";
import { hrGuide } from "./hr";
import { invoiceGuide } from "./invoice";
import type { GuideDefinition, GuideId } from "./types";
import { ujpGuide } from "./ujp";
import { xmlGuide } from "./xml";

export const guides: GuideDefinition[] = [
  invoiceGuide,
  ujpGuide,
  hrGuide,
  bankGuide,
  customerGuide,
  xmlGuide,
];

export function getGuide(guideId: GuideId) {
  return guides.find((guide) => guide.id === guideId);
}

export type { GuideDefinition, GuideId } from "./types";
