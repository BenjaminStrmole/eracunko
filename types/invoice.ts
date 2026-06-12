export type VatCategory = "S" | "Z" | "E" | "AE" | "K" | "G" | "O";

export type InvoiceStatus = "DRAFT" | "READY" | "SENT" | "ERROR";

export type Party = {
  name: string;
  vat: string;
  taxId?: string;

  address: string;
  street?: string;
  postCode?: string;
  city?: string;
  country?: string;

  eLocation: string;
  eAddress?: string;
};

export type InvoiceLine = {
  id: number;
  description: string;

  quantity: number;
  unit?: string;

  price: number;
  vatRate: number;
  vatCategory?: VatCategory;

  itemCode?: string;
  note?: string;
  taxExemptionReason?: string;

  netAmount?: number;
  vatAmount?: number;
  grossAmount?: number;
};

export type VatBreakdown = {
  vatCategory: VatCategory;
  vatRate: number;
  taxableAmount: number;
  vatAmount: number;
  taxExemptionReason?: string;
};

export type InvoiceTotals = {
  net: number;
  vat: number;
  gross: number;
  payable?: number;
};

export type InvoicePayment = {
  method?: string;
  paymentMeansCode?: string;
  purposeCode?: string;
  bankAccount?: string;
  iban?: string;
  bankBic?: string;
  bic?: string;
  reference?: string;
  paymentTerms?: string;
};

export type InvoiceReferences = {
  orderReference?: string;
  contractReference?: string;
  deliveryNoteReference?: string;
  buyerReference?: string;
};

export type ESlogData = {
  specificationIdentifier?: string;
  customizationId?: string;
  profileId?: string;
  documentType?: string;
  businessProcess?: string;
  paymentMeansCode?: string;
  purposeCode?: string;
  language?: string;
};

export type Invoice = {
  id?: number;

  number: string;
  issueDate: string;
  serviceDate: string;
  dueDate: string;

  currency: "EUR";
  documentType?: string;
  businessProcess?: string;

  seller?: Party;
  buyer: Party;

  lines: InvoiceLine[];
  vatBreakdown?: VatBreakdown[];

  totals: InvoiceTotals;

  payment?: InvoicePayment;
  references?: InvoiceReferences;
  eSlog?: ESlogData;

  note?: string;

  // backward compatibility
  paymentMethod?: string;
  paymentMeansCode?: string;
  purposeCode?: string;
  bankAccount?: string;
  bankBic?: string;
  reference?: string;

  xml?: string;
  docId?: string;
  status?: InvoiceStatus;

  createdAt?: string;
  updatedAt?: string;
  sentAt?: string;
};