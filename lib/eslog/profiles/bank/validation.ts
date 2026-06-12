import type { Invoice } from "../../../../types/invoice";
import type { ProfileValidationOutput } from "../types";

function value(valueToCheck: unknown) {
  return String(valueToCheck ?? "").trim();
}

function isEmpty(valueToCheck: unknown) {
  return value(valueToCheck) === "";
}

function isIban(valueToCheck: unknown) {
  return /^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(
    value(valueToCheck).replace(/\s/g, "").toUpperCase()
  );
}

export function validateBankProfile(invoice: Invoice): ProfileValidationOutput {
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

