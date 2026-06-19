import type {
  Invoice,
  InvoiceLine,
  Party,
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

function normalizePartyVat(value: string | undefined, country: string | undefined) {
  const normalized = normalizeVat(value);
  const countryCode = clean(country).toUpperCase();

  if (countryCode === "SI" && /^\d{8}$/.test(normalized)) return `SI${normalized}`;
  if (countryCode === "HR" && /^\d{11}$/.test(normalized)) return `HR${normalized}`;
  return normalized;
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

function parseAddressParts(address: string | undefined) {
  const value = clean(address);
  const [streetPart = "", cityPart = "", countryPart = ""] = value
    .split(",")
    .map((part) => clean(part));
  const cityMatch = cityPart.match(/^(\d{4,10})\s+(.+)$/);

  return {
    street: streetPart,
    postCode: cityMatch?.[1] || "",
    city: cityMatch?.[2] || cityPart,
    country: /^[A-Z]{2}$/.test(countryPart.toUpperCase())
      ? countryPart.toUpperCase()
      : "",
  };
}

export function normalizePartyAddress<T extends Party>(party: T): T {
  const parsed = parseAddressParts(party.address);
  const street = clean(party.street || parsed.street || party.address);
  const postCode = clean(party.postCode || parsed.postCode);
  const city = clean(party.city || parsed.city);
  const country = clean(party.country || parsed.country || countryFromVat(party.vat || party.taxId));

  return {
    ...party,
    address: clean(party.address),
    street,
    postCode,
    city,
    country,
  };
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
  const price = line.price;
  const vatCategory = normalizeVatCategory(line);
  const vatRate = ZERO_VAT_CATEGORIES.has(vatCategory)
    ? 0
    : Number(line.vatRate || 0);

  const hasValidAmounts = Number.isFinite(quantity) && Number.isFinite(price);
  const netAmount = hasValidAmounts ? round2(quantity * price) : undefined;
  const vatAmount =
    netAmount === undefined
      ? undefined
      : ZERO_VAT_CATEGORIES.has(vatCategory)
        ? 0
        : round2(netAmount * (vatRate / 100));
  const grossAmount =
    netAmount !== undefined && vatAmount !== undefined
      ? round2(netAmount + vatAmount)
      : undefined;

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
  const normalizedSellerAddress = invoice.seller
    ? normalizePartyAddress(invoice.seller)
    : invoice.seller;
  const normalizedBuyerAddress = normalizePartyAddress(invoice.buyer);

  const net = round2(lines.reduce((sum, line) => sum + (line.netAmount || 0), 0));
  const vat = round2(
    vatBreakdown.reduce((sum, breakdown) => sum + breakdown.vatAmount, 0)
  );
  const gross = round2(net + vat);

  const sellerVat = normalizePartyVat(
    normalizedSellerAddress?.vat,
    normalizedSellerAddress?.country
  );
  const buyerVat = normalizePartyVat(
    normalizedBuyerAddress.vat,
    normalizedBuyerAddress.country
  );
  const sellerOib = normalizeOib(normalizedSellerAddress?.oib || sellerVat);
  const buyerOib = normalizeOib(normalizedBuyerAddress.oib || buyerVat);

  const payment = invoice.payment || {};
  const hrData = invoice.hrData || {};
  const ujpData = invoice.ujpData || {};
  const bankData = invoice.bankData || {};
  const businessProcess =
    hrData.businessProcessType ||
    invoice.businessProcess ||
    invoice.eSlog?.businessProcess ||
    DEFAULT_PROFILE_ID;
  const documentType = invoice.documentType || invoice.eSlog?.documentType || "380";
  const paymentIban = bankData.payeeIban || payment.iban || payment.bankAccount || invoice.bankAccount;
  const paymentBic = bankData.payeeBic || payment.bic || payment.bankBic || invoice.bankBic;
  const paymentReference = bankData.paymentReference || payment.reference || invoice.reference;
  const paymentMeansCode = clean(
    bankData.paymentMeansCode ||
      payment.paymentMeansCode ||
      invoice.paymentMeansCode ||
      invoice.eSlog?.paymentMeansCode
  );

  return {
    ...invoice,
    profile: invoice.profile || "standard",

    currency: "EUR",
    number:
      (hrData.invoiceNumberNumericPart || invoice.invoiceNumberNumericPart) &&
      (hrData.businessPremiseCode || invoice.businessPremiseCode) &&
      (hrData.deviceCode || invoice.deviceCode)
        ? `${hrData.invoiceNumberNumericPart || invoice.invoiceNumberNumericPart}-${hrData.businessPremiseCode || invoice.businessPremiseCode}-${hrData.deviceCode || invoice.deviceCode}`
        : clean(invoice.number),
    documentType,
    businessProcess,
    issueTime: clean(hrData.issueTime || invoice.issueTime),
    isCopy: hrData.isCopy ?? invoice.isCopy,
    operator: {
      ...invoice.operator,
      oib: normalizeOib(hrData.operatorOib || invoice.operator?.oib),
      code: clean(hrData.operatorCode || invoice.operator?.code),
      name: clean(hrData.operatorName || invoice.operator?.name),
    },
    hrData: {
      ...hrData,
      invoiceNumberNumericPart: clean(hrData.invoiceNumberNumericPart || invoice.invoiceNumberNumericPart),
      businessPremiseCode: clean(hrData.businessPremiseCode || invoice.businessPremiseCode),
      deviceCode: clean(hrData.deviceCode || invoice.deviceCode),
      issueTime: clean(hrData.issueTime || invoice.issueTime),
      businessProcessType: clean(hrData.businessProcessType || businessProcess),
      operatorOib: normalizeOib(hrData.operatorOib || invoice.operator?.oib),
      operatorCode: clean(hrData.operatorCode || invoice.operator?.code),
      operatorName: clean(hrData.operatorName || invoice.operator?.name),
    },
    ujpData: {
      ...ujpData,
      orderReference: clean(ujpData.orderReference || invoice.references?.orderReference),
      contractReference: clean(ujpData.contractReference || invoice.references?.contractReference),
      buyerReference: clean(ujpData.buyerReference || invoice.references?.buyerReference),
    },
    bankData: {
      ...bankData,
      payeeIban: normalizeIban(paymentIban),
      payeeBic: clean(paymentBic),
      paymentReference: clean(paymentReference),
      purposeCode: clean(bankData.purposeCode || payment.purposeCode || invoice.purposeCode),
      paymentMeansCode,
      payeeName: clean(bankData.payeeName || normalizedSellerAddress?.name),
      payerName: clean(bankData.payerName || normalizedBuyerAddress.name),
    },

    seller: normalizedSellerAddress
      ? {
          ...normalizedSellerAddress,
          name: clean(normalizedSellerAddress.name),
          vat: sellerVat,
          taxId: normalizeVat(normalizedSellerAddress.taxId),
          oib: sellerOib,
          address: clean(normalizedSellerAddress.address),
          street: clean(normalizedSellerAddress.street),
          postCode: clean(normalizedSellerAddress.postCode),
          city: clean(normalizedSellerAddress.city),
          country: clean(normalizedSellerAddress.country || countryFromVat(sellerVat)),
          eLocation: clean(normalizedSellerAddress.eLocation || `C:${sellerVat}`),
          eAddress: clean(normalizedSellerAddress.eAddress || defaultEAddress(sellerVat)),
          endpointId: clean(normalizedSellerAddress.endpointId || sellerOib || sellerVat),
          endpointSchemeId: clean(normalizedSellerAddress.endpointSchemeId || "9934"),
          registrationNumber: clean(normalizedSellerAddress.registrationNumber),
          contactName: clean(normalizedSellerAddress.contactName),
          contactEmail: clean(normalizedSellerAddress.contactEmail),
        }
      : normalizedSellerAddress,

    buyer: {
      ...normalizedBuyerAddress,
      name: clean(normalizedBuyerAddress.name),
      vat: buyerVat,
      taxId: normalizeVat(normalizedBuyerAddress.taxId),
      oib: buyerOib,
      address: clean(normalizedBuyerAddress.address),
      street: clean(normalizedBuyerAddress.street),
      postCode: clean(normalizedBuyerAddress.postCode),
      city: clean(normalizedBuyerAddress.city),
      country: clean(normalizedBuyerAddress.country || countryFromVat(buyerVat)),
      eLocation: clean(normalizedBuyerAddress.eLocation || `C:${buyerVat}`),
      eAddress: clean(normalizedBuyerAddress.eAddress || defaultEAddress(buyerVat)),
      endpointId: clean(normalizedBuyerAddress.endpointId || buyerOib || buyerVat),
      endpointSchemeId: clean(normalizedBuyerAddress.endpointSchemeId || "9934"),
      registrationNumber: clean(normalizedBuyerAddress.registrationNumber),
      contactName: clean(normalizedBuyerAddress.contactName),
      contactEmail: clean(normalizedBuyerAddress.contactEmail),
    },

    lines,
    vatBreakdown,

    totals: {
      net,
      vat,
      gross,
      payable: round2(invoice.totals?.payable ?? gross),
    },

    references: {
      ...invoice.references,
      orderReference: clean(invoice.references?.orderReference || ujpData.orderReference),
      contractReference: clean(invoice.references?.contractReference || ujpData.contractReference),
      deliveryNoteReference: clean(
        invoice.references?.deliveryNoteReference || ujpData.additionalReference
      ),
      buyerReference: clean(invoice.references?.buyerReference || ujpData.buyerReference),
    },

    payment: {
      ...payment,
      method: payment.method || invoice.paymentMethod || "TRR",
      paymentMeansCode,
      purposeCode: bankData.purposeCode || payment.purposeCode || invoice.purposeCode || "OTHR",
      bankAccount: normalizeIban(
        payment.bankAccount || paymentIban
      ),
      iban: normalizeIban(paymentIban),
      bankBic: clean(payment.bankBic || paymentBic),
      bic: clean(paymentBic),
      reference: clean(paymentReference),
      paymentTerms:
        payment.paymentTerms ||
        `Plačilo do ${invoice.dueDate}. Sklic: ${clean(
          paymentReference
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
      paymentMeansCode,
      purposeCode:
        invoice.payment?.purposeCode ||
        bankData.purposeCode ||
        invoice.purposeCode ||
        invoice.eSlog?.purposeCode ||
        "OTHR",
      language: invoice.eSlog?.language || "sl",
    },

    paymentMethod: invoice.paymentMethod || payment.method || "TRR",
    paymentMeansCode,
    purposeCode: invoice.purposeCode || bankData.purposeCode || payment.purposeCode || "OTHR",
    bankAccount: normalizeIban(invoice.bankAccount || paymentIban),
    bankBic: clean(invoice.bankBic || paymentBic),
    reference: clean(invoice.reference || paymentReference),
  };
}
