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
  validationRules: string[];
  xmlMappingHints: string[];
  profileFields: ProfileFieldDefinition[];
};

export type ProfileFieldDefinition = {
  name: string;
  label: string;
  type: "text" | "date" | "time" | "checkbox" | "select";
  scope?: "invoice" | "line";
  required?: boolean;
  helper?: string;
  placeholder?: string;
  options?: Array<{
    label: string;
    value: string;
  }>;
  span?: "full" | "half";
};

export type InvoiceProfileImplementation = {
  config: InvoiceProfileConfig;
  validate: (invoice: Invoice) => ProfileValidationOutput;
  applyXml: (xml: string, invoice: Invoice) => string;
};
