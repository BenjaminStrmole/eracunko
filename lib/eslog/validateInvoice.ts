import type { Invoice, InvoiceLine, VatCategory } from "../../types/invoice";

type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

function isEmpty(value: unknown) {
  return value === undefined || value === null || String(value).trim() === "";
}

function normalize(value: unknown) {
  return String(value ?? "").trim();
}

function isPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isValidVatCategory(value: unknown): value is VatCategory {
  return ["S", "Z", "E", "AE", "K", "G", "O"].includes(String(value));
}

function validateLine(line: InvoiceLine, index: number) {
  const errors: string[] = [];
  const warnings: string[] = [];

  const label = `Postavka ${index + 1}`;

  if (isEmpty(line.description)) {
    errors.push(`${label}: manjka opis postavke.`);
  }

  if (!isPositiveNumber(line.quantity)) {
    errors.push(`${label}: količina mora biti večja od 0.`);
  }

  if (typeof line.price !== "number" || !Number.isFinite(line.price) || line.price < 0) {
    errors.push(`${label}: cena mora biti veljavno število.`);
  }

  if (typeof line.vatRate !== "number" || !Number.isFinite(line.vatRate) || line.vatRate < 0) {
    errors.push(`${label}: DDV stopnja mora biti veljavno število.`);
  }

  if (!line.unit) {
    warnings.push(`${label}: manjka enota mere, uporabljena bo privzeta enota.`);
  }

  if (!line.vatCategory) {
    warnings.push(`${label}: manjka DDV kategorija, uporabljena bo S.`);
  } else if (!isValidVatCategory(line.vatCategory)) {
    errors.push(`${label}: DDV kategorija ni veljavna.`);
  }

  if (line.vatCategory === "S" && line.vatRate <= 0) {
    errors.push(`${label}: pri DDV kategoriji S mora biti DDV stopnja večja od 0.`);
  }

  if (["E", "AE", "K", "G", "O"].includes(String(line.vatCategory)) && !line.taxExemptionReason) {
    warnings.push(`${label}: za oproščeno/reverse charge postavko je priporočljiv razlog oprostitve.`);
  }

  return { errors, warnings };
}

export function validateInvoiceForEslog(invoice: Invoice): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (isEmpty(invoice.number)) errors.push("Manjka številka računa.");
  if (isEmpty(invoice.issueDate)) errors.push("Manjka datum izdaje.");
  if (isEmpty(invoice.serviceDate)) errors.push("Manjka datum opravljene storitve.");
  if (isEmpty(invoice.dueDate)) errors.push("Manjka rok plačila.");
  if (invoice.currency !== "EUR") errors.push("Valuta mora biti EUR.");

  if (!invoice.seller) {
    errors.push("Manjka izdajatelj računa.");
  } else {
    if (isEmpty(invoice.seller.name)) errors.push("Izdajatelj: manjka naziv.");
    if (isEmpty(invoice.seller.vat || invoice.seller.taxId)) {
      errors.push("Izdajatelj: manjka davčna številka.");
    }
    if (isEmpty(invoice.seller.address)) errors.push("Izdajatelj: manjka naslov.");
    if (isEmpty(invoice.seller.eLocation)) errors.push("Izdajatelj: manjka eLokacija.");
    if (isEmpty(invoice.seller.eAddress)) warnings.push("Izdajatelj: manjka eAddress, uporabljen bo fallback.");
  }

  if (!invoice.buyer) {
    errors.push("Manjka kupec računa.");
  } else {
    if (isEmpty(invoice.buyer.name)) errors.push("Kupec: manjka naziv.");
    if (isEmpty(invoice.buyer.vat || invoice.buyer.taxId)) errors.push("Kupec: manjka davčna številka.");
    if (isEmpty(invoice.buyer.address)) warnings.push("Kupec: manjka naslov.");
    if (isEmpty(invoice.buyer.eLocation)) errors.push("Kupec: manjka eLokacija.");
    if (isEmpty(invoice.buyer.eAddress)) warnings.push("Kupec: manjka eAddress, uporabljen bo fallback iz davčne številke.");
  }

  if (!invoice.lines || invoice.lines.length === 0) {
    errors.push("Račun mora imeti vsaj eno postavko.");
  } else {
    invoice.lines.forEach((line, index) => {
      const result = validateLine(line, index);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    });
  }

  if (!invoice.totals) {
    errors.push("Manjkajo skupni zneski računa.");
  } else {
    if (typeof invoice.totals.net !== "number" || !Number.isFinite(invoice.totals.net)) {
      errors.push("Neto znesek ni veljaven.");
    }

    if (typeof invoice.totals.vat !== "number" || !Number.isFinite(invoice.totals.vat)) {
      errors.push("DDV znesek ni veljaven.");
    }

    if (typeof invoice.totals.gross !== "number" || !Number.isFinite(invoice.totals.gross)) {
      errors.push("Bruto znesek ni veljaven.");
    }

    const expectedGross = Number((invoice.totals.net + invoice.totals.vat).toFixed(2));
    const actualGross = Number(invoice.totals.gross.toFixed(2));

    if (Math.abs(expectedGross - actualGross) > 0.01) {
      errors.push("Skupni zneski se ne ujemajo: neto + DDV ni enako bruto.");
    }
  }

  const payment = invoice.payment;

  if (!payment?.iban && !invoice.bankAccount) {
    warnings.push("Manjka IBAN oziroma bančni račun.");
  }

  if (!payment?.reference && !invoice.reference) {
    warnings.push("Manjka sklic plačila.");
  }

  if (!payment?.paymentMeansCode && !invoice.paymentMeansCode) {
    warnings.push("Manjka koda načina plačila, uporabljena bo 30.");
  }

  if (!payment?.purposeCode && !invoice.purposeCode) {
    warnings.push("Manjka koda namena, uporabljena bo OTHR.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function assertInvoiceReadyForEslog(invoice: Invoice) {
  const result = validateInvoiceForEslog(invoice);

  if (!result.valid) {
    throw new Error(result.errors.join("\n"));
  }

  return result;
}