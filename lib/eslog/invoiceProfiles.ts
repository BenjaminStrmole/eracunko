import type { Invoice, InvoiceProfile } from "../../types/invoice";
import { validateInvoiceForEslog } from "./validateInvoice";

export type InvoiceProfileConfig = {
  id: InvoiceProfile;
  label: string;
  description: string;
  requiredFields: string[];
  optionalFields: string[];
  sections: string[];
};

export type ProfileValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  profile: InvoiceProfile;
};

export const invoiceProfileConfigs: Record<InvoiceProfile, InvoiceProfileConfig> = {
  standard: {
    id: "standard",
    label: "Navaden",
    description: "Minimalni eSLOG 2.0 / EN16931 racun.",
    requiredFields: [
      "number",
      "issueDate",
      "documentType",
      "currency",
      "seller",
      "buyer",
      "lines",
      "vatBreakdown",
      "totals",
    ],
    optionalFields: ["note", "references", "paymentTerms"],
    sections: ["base", "buyer", "lines", "payment"],
  },
  hr: {
    id: "hr",
    label: "Hrvaška",
    description: "HR Fiskalizacija 2.0 / HR-CIUS z OIB, operaterjem in KPD.",
    requiredFields: [
      "hrData.issueTime",
      "hrData.businessProcessType",
      "hrData.operatorOib",
      "hrData.operatorCode",
      "line.kpdCode",
      "line.hrVatCategoryCode",
    ],
    optionalFields: ["hrData.previousInvoiceNumber", "hrData.selfBilling"],
    sections: ["base", "buyer", "lines", "payment", "hr"],
  },
  ujp: {
    id: "ujp",
    label: "UJP",
    description: "Javni sektor z narocilnico, pogodbo in referenco kupca.",
    requiredFields: ["references.orderReference", "references.contractReference", "references.buyerReference"],
    optionalFields: ["ujpData.budgetUser", "ujpData.ujpRecipient", "ujpData.publicProcurementReference"],
    sections: ["base", "buyer", "lines", "payment", "ujp"],
  },
  bank: {
    id: "bank",
    label: "Banka",
    description: "Placilni profil z obveznim IBAN/BIC/sklicem in kodo namena.",
    requiredFields: ["payment.iban", "payment.bic", "payment.reference", "payment.paymentMeansCode", "payment.purposeCode"],
    optionalFields: ["bankData.payerName", "bankData.payeeName"],
    sections: ["base", "buyer", "lines", "payment", "bank"],
  },
};

export const invoiceProfiles = Object.values(invoiceProfileConfigs);

function value(value: unknown) {
  return String(value ?? "").trim();
}

function isEmpty(valueToCheck: unknown) {
  return value(valueToCheck) === "";
}

function isTime(valueToCheck: unknown) {
  return /^\d{2}:\d{2}:\d{2}$/.test(value(valueToCheck));
}

function isDate(valueToCheck: unknown) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value(valueToCheck));
}

function isOib(valueToCheck: unknown) {
  return /^\d{11}$/.test(value(valueToCheck).replace(/\D/g, ""));
}

function isIban(valueToCheck: unknown) {
  return /^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(
    value(valueToCheck).replace(/\s/g, "").toUpperCase()
  );
}

function selectedProfile(invoice: Invoice): InvoiceProfile {
  return invoice.profile || "standard";
}

function validateHrProfile(invoice: Invoice) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const hrData = invoice.hrData || {};
  const processType = hrData.businessProcessType || invoice.businessProcess;
  const operatorOib = hrData.operatorOib || invoice.operator?.oib;
  const operatorCode = hrData.operatorCode || invoice.operator?.code || invoice.operator?.name;
  const invoiceNumber = invoice.number || [
    hrData.invoiceNumberNumericPart || invoice.invoiceNumberNumericPart,
    hrData.businessPremiseCode || invoice.businessPremiseCode,
    hrData.deviceCode || invoice.deviceCode,
  ]
    .filter(Boolean)
    .join("-");

  if (!/^\S+[-_/]\S+[-_/]\S+$/.test(invoiceNumber)) {
    errors.push("HR: številka računa mora imeti tri dele brez presledkov.");
  }

  if (!isTime(hrData.issueTime || invoice.issueTime)) {
    errors.push("HR: manjka čas izdaje v formatu HH:MM:SS.");
  }

  if (!/^P([1-9]|1[0-2])$/.test(value(processType)) && value(processType) !== "P99") {
    errors.push("HR: businessProcessType mora biti P1-P12 ali P99.");
  }

  if (value(processType) === "P99" && isEmpty(hrData.p99BuyerProcessId)) {
    errors.push("HR: pri P99 manjka kupčeva oznaka procesa.");
  }

  if (!isOib(operatorOib)) {
    errors.push("HR: OIB operaterja mora imeti 11 števk.");
  }

  if (isEmpty(operatorCode)) {
    errors.push("HR: manjka oznaka operaterja.");
  }

  if (hrData.previousInvoiceNumber && !isDate(hrData.previousInvoiceDate)) {
    errors.push("HR: pri predhodnem računu manjka datum v formatu YYYY-MM-DD.");
  }

  invoice.lines.forEach((line, index) => {
    const label = `HR: postavka ${index + 1}`;

    if (isEmpty(line.kpdCode)) {
      errors.push(`${label}: manjka KPD/klasifikacijska koda.`);
    }

    if (isEmpty(line.hrVatCategoryCode)) {
      errors.push(`${label}: manjka HR DDV oznaka kategorije.`);
    }
  });

  if (!invoice.seller?.eAddress || !invoice.buyer.eAddress) {
    errors.push("HR: prodajalec in kupec morata imeti elektronski naslov iz AMS.");
  }

  return { errors, warnings };
}

function validateUjpProfile(invoice: Invoice) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ujpData = invoice.ujpData || {};

  if (isEmpty(invoice.references?.orderReference || ujpData.orderReference)) {
    warnings.push("UJP: manjka naročilnica.");
  }

  if (isEmpty(invoice.references?.contractReference || ujpData.contractReference)) {
    warnings.push("UJP: manjka pogodba.");
  }

  if (isEmpty(invoice.references?.buyerReference || ujpData.buyerReference)) {
    warnings.push("UJP: manjka referenca kupca.");
  }

  if (isEmpty(ujpData.budgetUser || ujpData.ujpRecipient)) {
    warnings.push("UJP: priporočljiv je proračunski uporabnik oziroma UJP prejemnik.");
  }

  return { errors, warnings };
}

function validateBankProfile(invoice: Invoice) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const bankData = invoice.bankData || {};
  const payment = invoice.payment || {};
  const iban = bankData.payeeIban || payment.iban || payment.bankAccount || invoice.bankAccount;
  const bic = bankData.payeeBic || payment.bic || payment.bankBic || invoice.bankBic;
  const reference = bankData.paymentReference || payment.reference || invoice.reference;

  if (!isIban(iban)) {
    errors.push("Banka: IBAN ni v veljavnem formatu.");
  }

  if (isEmpty(bic)) {
    errors.push("Banka: manjka BIC.");
  }

  if (isEmpty(reference)) {
    errors.push("Banka: manjka model/sklic plačila.");
  }

  if (isEmpty(bankData.purposeCode || payment.purposeCode || invoice.purposeCode)) {
    errors.push("Banka: manjka koda namena.");
  }

  if (isEmpty(bankData.paymentMeansCode || payment.paymentMeansCode || invoice.paymentMeansCode)) {
    errors.push("Banka: manjka način plačila.");
  }

  if (isEmpty(bankData.payerName)) {
    warnings.push("Banka: priporočljiv je naziv plačnika.");
  }

  if (isEmpty(bankData.payeeName)) {
    warnings.push("Banka: priporočljiv je naziv prejemnika plačila.");
  }

  return { errors, warnings };
}

export function validateInvoiceByProfile(invoice: Invoice): ProfileValidationResult {
  const base = validateInvoiceForEslog(invoice);
  const profile = selectedProfile(invoice);
  const profileResult =
    profile === "hr"
      ? validateHrProfile(invoice)
      : profile === "ujp"
        ? validateUjpProfile(invoice)
        : profile === "bank"
          ? validateBankProfile(invoice)
          : { errors: [], warnings: [] };

  const errors = [...base.errors, ...profileResult.errors];
  const warnings = [...base.warnings, ...profileResult.warnings];

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    profile,
  };
}
