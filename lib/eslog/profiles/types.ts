import type { Invoice, InvoiceProfile } from "../../../types/invoice";

export type ProfileValidationOutput = {
  errors: string[];
  warnings: string[];
};

export type InvoiceProfileConfig = {
  id: InvoiceProfile;
  label: string;
  description: string;
  requiredFields: string[];
  optionalFields: string[];
  sections: string[];
};

export type InvoiceProfileImplementation = {
  config: InvoiceProfileConfig;
  validate: (invoice: Invoice) => ProfileValidationOutput;
  applyXml: (xml: string, invoice: Invoice) => string;
};

