import type { Invoice, InvoiceProfile } from "../../types/invoice";
import { buildEslogInvoiceXml } from "./buildEslogInvoiceXml";
import { prepareInvoiceForEslog } from "./prepareInvoiceForEslog";

const baseInvoice: Invoice = {
  profile: "standard",
  number: "2026-001",
  issueDate: "2026-01-15",
  serviceDate: "2026-01-15",
  dueDate: "2026-01-30",
  currency: "EUR",
  documentType: "380",
  businessProcess: "P1",
  seller: {
    name: "Demo prodajalec",
    vat: "SI12345678",
    address: "Testna 1",
    postCode: "1000",
    city: "Ljubljana",
    country: "SI",
    eLocation: "C:SI12345678",
    eAddress: "SI12345678.HQ",
  },
  buyer: {
    name: "Demo kupec",
    vat: "SI87654321",
    address: "Kupceva 1",
    postCode: "2000",
    city: "Maribor",
    country: "SI",
    eLocation: "C:SI87654321",
    eAddress: "SI87654321.HQ",
  },
  payment: {
    paymentMeansCode: "58",
    purposeCode: "OTHR",
    iban: "SI56191000000123438",
    bic: "TESTSI22",
    reference: "SI00-2026001",
  },
  lines: [
    {
      id: 1,
      description: "Testna storitev",
      quantity: 2,
      unit: "H87",
      price: 100,
      vatRate: 22,
      vatCategory: "S",
    },
  ],
  totals: {
    net: 200,
    vat: 44,
    gross: 244,
    payable: 244,
  },
};

export const profileExampleInvoices: Record<InvoiceProfile, Invoice> = {
  standard: baseInvoice,
  hr: {
    ...baseInvoice,
    profile: "hr",
    number: "1-PP01-01",
    invoiceNumberNumericPart: "1",
    businessPremiseCode: "PP01",
    deviceCode: "01",
    issueTime: "12:00:00",
    businessProcess: "P1",
    seller: {
      ...baseInvoice.seller!,
      vat: "HR12345678901",
      taxId: "HR12345678901",
      oib: "12345678901",
      country: "HR",
      eLocation: "C:HR12345678901",
      eAddress: "HR12345678901.HQ",
    },
    buyer: {
      ...baseInvoice.buyer,
      vat: "HR10987654321",
      taxId: "HR10987654321",
      oib: "10987654321",
      country: "HR",
      eLocation: "C:HR10987654321",
      eAddress: "HR10987654321.HQ",
    },
    operator: {
      oib: "12345678901",
      code: "Operater1",
    },
    hrData: {
      invoiceNumberNumericPart: "1",
      businessPremiseCode: "PP01",
      deviceCode: "01",
      issueTime: "12:00:00",
      businessProcessType: "P1",
      operatorOib: "12345678901",
      operatorCode: "Operater1",
    },
    lines: [
      {
        ...baseInvoice.lines[0],
        vatRate: 25,
        hrVatCategoryCode: "PDV25",
        kpdCode: "62.01.11",
        kpdListId: "CG",
      },
    ],
    totals: {
      net: 200,
      vat: 50,
      gross: 250,
      payable: 250,
    },
  },
  ujp: {
    ...baseInvoice,
    profile: "ujp",
    references: {
      orderReference: "PO-2026-001",
      contractReference: "CTR-2026-001",
      buyerReference: "BR-2026-001",
    },
    ujpData: {
      orderReference: "PO-2026-001",
      contractReference: "CTR-2026-001",
      buyerReference: "BR-2026-001",
      budgetUser: "12345",
      ujpRecipient: "Demo javni narocnik",
    },
  },
  bank: {
    ...baseInvoice,
    profile: "bank",
    bankData: {
      payeeIban: "SI56191000000123438",
      payeeBic: "TESTSI22",
      paymentModel: "SI00",
      paymentReference: "SI00-2026001",
      purposeCode: "OTHR",
      paymentMeansCode: "58",
      payerName: "Demo kupec",
      payeeName: "Demo prodajalec",
    },
  },
};

export function assertProfileExamples() {
  for (const [profile, invoice] of Object.entries(profileExampleInvoices)) {
    const prepared = prepareInvoiceForEslog(invoice);

    if (!prepared.validation.valid) {
      throw new Error(`${profile} example is invalid: ${prepared.validation.errors.join(", ")}`);
    }

    const xml = buildEslogInvoiceXml(invoice);

    if (!xml.includes("<M_INVOIC")) {
      throw new Error(`${profile} example did not generate eSLOG XML.`);
    }
  }
}
