export type VatCategory = "S" | "Z" | "E" | "AE" | "K" | "G" | "O" | "IC";

export type InvoiceStatus = "DRAFT" | "READY" | "SENT" | "ERROR";
export type InvoiceProfile = "standard" | "hr" | "ujp" | "bank";

export type Party = {
  name: string;
  vat: string;
  taxId?: string;
  oib?: string;

  address: string;
  street?: string;
  postCode?: string;
  city?: string;
  country?: string;

  eLocation: string;
  eAddress?: string;
  endpointId?: string;
  endpointSchemeId?: string;
  registrationNumber?: string;
  contactName?: string;
  contactEmail?: string;
};

export type InvoiceLine = {
  id: number;
  description: string;

  quantity: number;
  unit?: string;

  price: number;
  vatRate: number;
  vatCategory?: VatCategory;
  hrVatCategoryCode?: string;

  itemCode?: string;
  note?: string;
  itemDescription?: string;
  taxExemptionReason?: string;
  taxExemptionReasonCode?: string;
  kpdCode?: string;
  kpdListId?: string;

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

export type InvoiceOperator = {
  oib?: string;
  code?: string;
  name?: string;
};

export type HrInvoiceData = {
  invoiceNumberNumericPart?: string;
  businessPremiseCode?: string;
  deviceCode?: string;
  issueTime?: string;
  businessProcessType?: string;
  p99BuyerProcessId?: string;
  operatorOib?: string;
  operatorCode?: string;
  operatorName?: string;
  isCopy?: boolean;
  selfBilling?: boolean;
  previousInvoiceNumber?: string;
  previousInvoiceDate?: string;
};

export type UjpInvoiceData = {
  orderReference?: string;
  contractReference?: string;
  deliveryNoteReference?: string;
  buyerReference?: string;
  budgetUser?: string;
  ujpRecipient?: string;
  publicProcurementReference?: string;
  additionalReference?: string;
};

export type BankInvoiceData = {
  payeeIban?: string;
  payeeBic?: string;
  paymentModel?: string;
  paymentReference?: string;
  purposeCode?: string;
  paymentMeansCode?: string;
  payerName?: string;
  payeeName?: string;
};

export type Invoice = {
  id?: number;
  profile?: InvoiceProfile;

  number: string;
  invoiceNumberNumericPart?: string;
  businessPremiseCode?: string;
  deviceCode?: string;

  issueDate: string;
  issueTime?: string;
  serviceDate: string;
  dueDate: string;

  currency: "EUR";
  documentType?: string;
  businessProcess?: string;
  isCopy?: boolean;
  cashAccounting?: boolean;
  operator?: InvoiceOperator;
  hrData?: HrInvoiceData;
  ujpData?: UjpInvoiceData;
  bankData?: BankInvoiceData;

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
