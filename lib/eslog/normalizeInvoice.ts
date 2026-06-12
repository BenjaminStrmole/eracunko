import type {
  Invoice,
  InvoiceLine,
  VatBreakdown,
  VatCategory,
} from "../../types/invoice";

const DEFAULT_SPECIFICATION_IDENTIFIER = "urn:cen.eu:en16931:2017";
const DEFAULT_CUSTOMIZATION_ID = "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0";
const DEFAULT_PROFILE_ID = "P1";
const ZERO_VAT_CATEGORIES = new Set(["Z", "E", "AE", "K", "G", "O", "IC"]);

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeVat(value: string | undefined) {
  return clean(value).replace(/\s/g, "").toUpperCase();
}

function normalizeOib(value: string | undefined) {
  return clean(value).replace(/\D/g, "").slice(0, 11);
}

function normalizeIban(value: string | undefined) {
  return clean(value).replace(/\s/g, "").toUpperCase();
}

function countryFromVat(vat: string | undefined, fallback = "SI") {
  const normalized = normalizeVat(vat);

  if (/^[A-Z]{2}/.test(normalized)) return normalized.slice(0, 2);

  return fallback;
}

function defaultEAddress(vat: string | undefined) {
  const normalized = normalizeVat(vat);

  if (!normalized) return "";

  return `${normalized}.HQ`;
}

function normalizeVatCategory(line: InvoiceLine): VatCategory {
  if (line.vatCategory) return line.vatCategory;

  if (line.vatRate === 0) return "Z";

  return "S";
}

function normalizeUnit(unit: string | undefined) {
  const value = clean(unit).toUpperCase();

  if (!value) return "H87";

  return value;
}

function normalizeLine(line: InvoiceLine): InvoiceLine {
  const quantity = Number(line.quantity || 0);
  const price = Number(line.price || 0);
  const vatCategory = normalizeVatCategory(line);
  const vatRate = ZERO_VAT_CATEGORIES.has(vatCategory)
    ? 0
    : Number(line.vatRate || 0);

  const netAmount = round2(quantity * price);
  const vatAmount = ZERO_VAT_CATEGORIES.has(vatCategory)
    ? 0
    : round2(netAmount * (vatRate / 100));
  const grossAmount = round2(netAmount + vatAmount);

  return {
    ...line,
    description: clean(line.description),
    itemCode: clean(line.itemCode),
    itemDescription: clean(line.itemDescription),
    note: clean(line.note),
    quantity,
    price,
    vatRate,
    unit: normalizeUnit(line.unit),
    vatCategory,
    hrVatCategoryCode: clean(line.hrVatCategoryCode),
    taxExemptionReason: clean(line.taxExemptionReason),
    taxExemptionReasonCode: clean(line.taxExemptionReasonCode),
    kpdCode: clean(line.kpdCode),
    kpdListId: clean(line.kpdListId || "CG"),
    netAmount,
    vatAmount,
    grossAmount,
  };
}

function buildVatBreakdown(lines: InvoiceLine[]): VatBreakdown[] {
  const map = new Map<string, VatBreakdown>();

  for (const line of lines) {
    const vatCategory = normalizeVatCategory(line);
    const vatRate = Number(line.vatRate || 0);
    const key = `${vatCategory}_${vatRate}`;
    const netAmount =
      typeof line.netAmount === "number"
        ? line.netAmount
        : round2(Number(line.quantity || 0) * Number(line.price || 0));
    const vatAmount =
      typeof line.vatAmount === "number"
        ? line.vatAmount
        : !ZERO_VAT_CATEGORIES.has(vatCategory)
          ? round2(netAmount * (vatRate / 100))
          : 0;

    const current = map.get(key);

    if (current) {
      current.taxableAmount = round2(current.taxableAmount + netAmount);
      current.vatAmount = round2(current.vatAmount + vatAmount);
    } else {
      map.set(key, {
        vatCategory,
        vatRate,
        taxableAmount: netAmount,
        vatAmount,
        taxExemptionReason: line.taxExemptionReason,
      });
    }
  }

  return [...map.values()];
}

export function normalizeInvoiceForEslog(invoice: Invoice): Invoice {
  const lines = invoice.lines.map(normalizeLine);
  const vatBreakdown = buildVatBreakdown(lines);

  const net = round2(lines.reduce((sum, line) => sum + (line.netAmount || 0), 0));
  const vat = round2(
    vatBreakdown.reduce((sum, breakdown) => sum + breakdown.vatAmount, 0)
  );
  const gross = round2(net + vat);

  const sellerVat = normalizeVat(invoice.seller?.vat || invoice.seller?.taxId);
  const buyerVat = normalizeVat(invoice.buyer?.vat || invoice.buyer?.taxId);
  const sellerOib = normalizeOib(invoice.seller?.oib || sellerVat);
  const buyerOib = normalizeOib(invoice.buyer?.oib || buyerVat);

  const payment = invoice.payment || {};
  const businessProcess =
    invoice.businessProcess || invoice.eSlog?.businessProcess || DEFAULT_PROFILE_ID;
  const documentType = invoice.documentType || invoice.eSlog?.documentType || "380";

  return {
    ...invoice,

    currency: "EUR",
    number:
      invoice.invoiceNumberNumericPart &&
      invoice.businessPremiseCode &&
      invoice.deviceCode
        ? `${invoice.invoiceNumberNumericPart}-${invoice.businessPremiseCode}-${invoice.deviceCode}`
        : clean(invoice.number),
    documentType,
    businessProcess,
    issueTime: clean(invoice.issueTime),
    operator: {
      ...invoice.operator,
      oib: normalizeOib(invoice.operator?.oib),
      code: clean(invoice.operator?.code),
      name: clean(invoice.operator?.name),
    },

    seller: invoice.seller
      ? {
          ...invoice.seller,
          name: clean(invoice.seller.name),
          vat: sellerVat,
          taxId: normalizeVat(invoice.seller.taxId),
          oib: sellerOib,
          address: clean(invoice.seller.address),
          street: clean(invoice.seller.street),
          postCode: clean(invoice.seller.postCode),
          city: clean(invoice.seller.city),
          country: clean(invoice.seller.country || countryFromVat(sellerVat)),
          eLocation: clean(invoice.seller.eLocation || `C:${sellerVat}`),
          eAddress: clean(invoice.seller.eAddress || defaultEAddress(sellerVat)),
          endpointId: clean(invoice.seller.endpointId || sellerOib || sellerVat),
          endpointSchemeId: clean(invoice.seller.endpointSchemeId || "9934"),
          registrationNumber: clean(invoice.seller.registrationNumber),
          contactName: clean(invoice.seller.contactName),
          contactEmail: clean(invoice.seller.contactEmail),
        }
      : invoice.seller,

    buyer: {
      ...invoice.buyer,
      name: clean(invoice.buyer.name),
      vat: buyerVat,
      taxId: normalizeVat(invoice.buyer.taxId),
      oib: buyerOib,
      address: clean(invoice.buyer.address),
      street: clean(invoice.buyer.street),
      postCode: clean(invoice.buyer.postCode),
      city: clean(invoice.buyer.city),
      country: clean(invoice.buyer.country || countryFromVat(buyerVat)),
      eLocation: clean(invoice.buyer.eLocation || `C:${buyerVat}`),
      eAddress: clean(invoice.buyer.eAddress || defaultEAddress(buyerVat)),
      endpointId: clean(invoice.buyer.endpointId || buyerOib || buyerVat),
      endpointSchemeId: clean(invoice.buyer.endpointSchemeId || "9934"),
      contactName: clean(invoice.buyer.contactName),
      contactEmail: clean(invoice.buyer.contactEmail),
    },

    lines,
    vatBreakdown,

    totals: {
      net,
      vat,
      gross,
      payable: round2(invoice.totals?.payable ?? gross),
    },

    payment: {
      ...payment,
      method: payment.method || invoice.paymentMethod || "TRR",
      paymentMeansCode:
        payment.paymentMeansCode || invoice.paymentMeansCode || "58",
      purposeCode: payment.purposeCode || invoice.purposeCode || "OTHR",
      bankAccount: normalizeIban(
        payment.bankAccount || invoice.bankAccount || payment.iban
      ),
      iban: normalizeIban(payment.iban || invoice.bankAccount || payment.bankAccount),
      bankBic: clean(payment.bankBic || invoice.bankBic || payment.bic),
      bic: clean(payment.bic || invoice.bankBic || payment.bankBic),
      reference: clean(payment.reference || invoice.reference),
      paymentTerms:
        payment.paymentTerms ||
        `Plačilo do ${invoice.dueDate}. Sklic: ${clean(
          payment.reference || invoice.reference
        )}`,
    },

    eSlog: {
      ...invoice.eSlog,
      specificationIdentifier:
        invoice.eSlog?.specificationIdentifier || DEFAULT_SPECIFICATION_IDENTIFIER,
      customizationId: invoice.eSlog?.customizationId || DEFAULT_CUSTOMIZATION_ID,
      profileId: invoice.eSlog?.profileId || businessProcess,
      documentType,
      businessProcess,
      paymentMeansCode:
        invoice.payment?.paymentMeansCode ||
        invoice.paymentMeansCode ||
        invoice.eSlog?.paymentMeansCode ||
        "58",
      purposeCode:
        invoice.payment?.purposeCode ||
        invoice.purposeCode ||
        invoice.eSlog?.purposeCode ||
        "OTHR",
      language: invoice.eSlog?.language || "sl",
    },

    paymentMethod: invoice.paymentMethod || payment.method || "TRR",
    paymentMeansCode:
      invoice.paymentMeansCode || payment.paymentMeansCode || "58",
    purposeCode: invoice.purposeCode || payment.purposeCode || "OTHR",
    bankAccount: normalizeIban(invoice.bankAccount || payment.iban || payment.bankAccount),
    bankBic: clean(invoice.bankBic || payment.bic || payment.bankBic),
    reference: clean(invoice.reference || payment.reference),
  };
}
