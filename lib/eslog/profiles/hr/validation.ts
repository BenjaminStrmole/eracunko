import type { Invoice } from "../../../../types/invoice";
import type { ProfileValidationOutput } from "../types";

function value(valueToCheck: unknown) {
  return String(valueToCheck ?? "").trim();
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

export function validateHrProfile(invoice: Invoice): ProfileValidationOutput {
  const errors: string[] = [];
  const warnings: string[] = [];
  const hrData = invoice.hrData || {};
  const processType = hrData.businessProcessType || invoice.businessProcess;
  const operatorOib = hrData.operatorOib || invoice.operator?.oib;
  const operatorCode = hrData.operatorCode || invoice.operator?.code || invoice.operator?.name;
  const invoiceNumber =
    invoice.number ||
    [
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

