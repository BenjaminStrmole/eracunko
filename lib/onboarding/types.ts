import type { Invoice, InvoiceProfile } from "../../types/invoice";

export type FieldSeverity = "error" | "warning";

export type FieldTarget = {
  fieldId: string;
  wizardStep: number;
  actionRoute?: string;
};

export type ValidationIssue = FieldTarget & {
  code: string;
  message: string;
  severity: FieldSeverity;
  lineId?: number;
};

export type FieldRule = {
  id: string;
  profiles: Array<InvoiceProfile | "all">;
  target: FieldTarget;
  label: string;
  instruction: string;
  scope: "base" | "profile";
  validate: (invoice: Invoice) => ValidationIssue | null;
};

export type InvoiceFieldWizardFlow = "invoice" | InvoiceProfile;

export type FieldWizardSessionStatus =
  | "active"
  | "paused"
  | "dismissed"
  | "completed";

export type FieldWizardSession = {
  id: string;
  flow: InvoiceFieldWizardFlow;
  profile?: InvoiceProfile;
  status: FieldWizardSessionStatus;
  phase: "invoice" | "settings" | "review" | "send";
  route: string;
  currentFieldId?: string;
  wizardStep?: number;
  pendingSellerFields: string[];
  invoiceDraft?: Invoice;
  startedAt: string;
  updatedAt: string;
};

export type FieldWizardCallbacks = {
  onCompleted: () => void;
  onPaused: () => void;
};

export type FieldWizardAdapter = {
  start: (
    flow: InvoiceFieldWizardFlow,
    callbacks: FieldWizardCallbacks,
    session?: FieldWizardSession
  ) => void;
  stop: () => void;
};
