import type { Invoice, InvoiceLine, VatCategory } from "../../types/invoice";
import { normalizePartyAddress } from "./normalizeInvoice";

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

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isValidVatCategory(value: unknown): value is VatCategory {
  return ["S", "Z", "E", "AE", "K", "G", "O", "IC"].includes(String(value));
}

function isDate(value: unknown) {
  return /^\d{4}-\d{2}-\d{2}$/.test(normalize(value));
}

function isTime(value: unknown) {
  return /^\d{2}:\d{2}:\d{2}$/.test(normalize(value));
}

function isHrVat(value: unknown) {
  return /^HR\d{11}$/.test(normalize(value).replace(/\s/g, "").toUpperCase());
}

function isOib(value: unknown) {
  return /^\d{11}$/.test(normalize(value).replace(/\D/g, ""));
}

function compactIdentifier(value: unknown) {
  return normalize(value).replace(/\s/g, "").toUpperCase();
}

function isValidVatOrTaxIdentifier(value: unknown, country: unknown) {
  const identifier = compactIdentifier(value);
  const countryCode = normalize(country).toUpperCase();

  if (!/^[A-Z0-9]+$/.test(identifier)) return false;
  if (countryCode === "SI" || identifier.startsWith("SI")) {
    return /^(?:SI)?\d{8}$/.test(identifier);
  }
  if (countryCode === "HR" || identifier.startsWith("HR")) {
    return /^(?:HR)?\d{11}$/.test(identifier);
  }

  const prefix = identifier.match(/^[A-Z]{2}/)?.[0];
  if (prefix && /^[A-Z]{2}$/.test(countryCode) && prefix !== countryCode) return false;
  return identifier.length >= 6 && identifier.length <= 20;
}

function isValidIban(value: unknown) {
  const iban = compactIdentifier(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;

  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  let remainder = 0;

  for (const character of rearranged) {
    const numeric = /[A-Z]/.test(character)
      ? String(character.charCodeAt(0) - 55)
      : character;
    for (const digit of numeric) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }

  return remainder === 1;
}

function isValidPaymentReference(value: unknown) {
  const reference = normalize(value);
  return (
    reference.length > 0 &&
    reference.length <= 140 &&
    !/[\u0000-\u001F\u007F]/.test(reference)
  );
}

function invoiceHasHrContext(invoice: Invoice) {
  return (
    invoice.seller?.country === "HR" ||
    invoice.buyer?.country === "HR" ||
    normalize(invoice.seller?.vat).startsWith("HR") ||
    normalize(invoice.buyer?.vat).startsWith("HR")
  );
}

function expectedLineNet(line: InvoiceLine) {
  return round2(Number(line.quantity || 0) * Number(line.price || 0));
}

function expectedLineVat(line: InvoiceLine) {
  const category = line.vatCategory || "S";
  if (["Z", "E", "AE", "K", "G", "O", "IC"].includes(category)) return 0;

  return round2(expectedLineNet(line) * (Number(line.vatRate || 0) / 100));
}

function validateLine(line: InvoiceLine, index: number, invoice: Invoice) {
  const errors: string[] = [];
  const warnings: string[] = [];

  const label = `Postavka ${index + 1}`;

  if (isEmpty(line.description)) {
    errors.push(`${label}: manjka opis postavke.`);
  }

  if (!isPositiveNumber(line.quantity)) {
    errors.push(`${label}: količina mora biti večja od 0.`);
  }

  if (isEmpty(line.price)) {
    errors.push(`${label}: BT-146 manjka neto cena postavke.`);
  } else if (typeof line.price !== "number" || !Number.isFinite(line.price) || line.price < 0) {
    errors.push(`${label}: BT-146 neto cena mora biti veljavno nenegativno število.`);
  }

  if (typeof line.vatRate !== "number" || !Number.isFinite(line.vatRate) || line.vatRate < 0) {
    errors.push(`${label}: DDV stopnja mora biti veljavno število.`);
  }

  if (!line.unit) {
    errors.push(`${label}: manjka enota mere.`);
  }

  if (!line.vatCategory) {
    errors.push(`${label}: manjka DDV kategorija.`);
  } else if (!isValidVatCategory(line.vatCategory)) {
    errors.push(`${label}: DDV kategorija ni veljavna.`);
  }

  if (line.vatCategory === "S" && line.vatRate <= 0) {
    errors.push(`${label}: pri DDV kategoriji S mora biti DDV stopnja večja od 0.`);
  }

  if (["Z", "E", "AE", "K", "G", "O", "IC"].includes(String(line.vatCategory))) {
    if (Number(line.vatRate || 0) !== 0) {
      errors.push(`${label}: DDV kategorija ${line.vatCategory} mora imeti DDV stopnjo 0.`);
    }

    if (!line.taxExemptionReason && !line.taxExemptionReasonCode) {
      errors.push(`${label}: manjka razlog ali koda davčne oprostitve.`);
    }
  }

  if (line.vatCategory === "AE" && isEmpty(invoice.buyer?.vat || invoice.buyer?.taxId)) {
    errors.push(`${label}: reverse charge zahteva kupčevo davčno številko.`);
  }

  if (normalize(line.description).length > 1024) {
    errors.push(`${label}: naziv/opis postavke presega 1024 znakov.`);
  }

  if (normalize(line.itemDescription || line.note).length > 4096) {
    errors.push(`${label}: dodatni opis postavke presega 4096 znakov.`);
  }

  if (invoiceHasHrContext(invoice) && isEmpty(line.kpdCode)) {
    errors.push(`${label}: za HR e-račun manjka KPD koda.`);
  }

  if (invoiceHasHrContext(invoice) && ["E", "AE", "O"].includes(String(line.vatCategory)) && !line.hrVatCategoryCode) {
    errors.push(`${label}: za HR DDV kategorijo ${line.vatCategory} manjka HR oznaka DDV kategorije.`);
  }

  if (typeof line.netAmount === "number" && Math.abs(round2(line.netAmount) - expectedLineNet(line)) > 0.01) {
    errors.push(`${label}: line net amount ni pravilno izračunan.`);
  }

  if (typeof line.vatAmount === "number" && Math.abs(round2(line.vatAmount) - expectedLineVat(line)) > 0.01) {
    errors.push(`${label}: DDV znesek postavke ni pravilno izračunan.`);
  }

  return { errors, warnings };
}

export function validateInvoiceForEslog(invoice: Invoice): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const hasStandardRatedVatLine = (invoice.lines || []).some(
    (line) => (line.vatCategory || "S") === "S"
  );
  const seller = invoice.seller ? normalizePartyAddress(invoice.seller) : invoice.seller;
  const buyer = normalizePartyAddress(invoice.buyer);

  if (isEmpty(invoice.number)) errors.push("Manjka številka računa.");
  if (invoiceHasHrContext(invoice) && !/^\S+[-_/]\S+[-_/]\S+$/.test(normalize(invoice.number))) {
    errors.push("HR številka računa mora imeti tri dele brez presledkov, npr. 1-PP01-01.");
  }
  if (!isDate(invoice.issueDate)) errors.push("Manjka datum izdaje ali format ni YYYY-MM-DD.");
  if (!isDate(invoice.serviceDate)) errors.push("Manjka datum opravljene storitve ali format ni YYYY-MM-DD.");
  if (!isDate(invoice.dueDate)) errors.push("Manjka rok plačila ali format ni YYYY-MM-DD.");
  if (invoiceHasHrContext(invoice) && !isTime(invoice.issueTime)) {
    errors.push("Za HR e-račun manjka čas izdaje v formatu HH:MM:SS.");
  }
  if (isEmpty(invoice.documentType || invoice.eSlog?.documentType)) {
    errors.push("Manjka tip dokumenta.");
  }
  const businessProcess = normalize(invoice.businessProcess || invoice.eSlog?.businessProcess);
  if (!/^P([1-9]|1[0-2])$/.test(businessProcess) && businessProcess !== "P99" && !businessProcess.startsWith("P99:")) {
    errors.push("Poslovni proces mora biti P1-P12 ali P99:oznakaKupca.");
  }
  if (isEmpty(invoice.eSlog?.specificationIdentifier)) {
    warnings.push("BT-24: manjka identifikator specifikacije, uporabljen bo privzeti EN16931.");
  }
  if (invoice.currency !== "EUR") errors.push("Valuta mora biti EUR.");

  if (!seller) {
    errors.push("Manjka izdajatelj računa.");
  } else {
    if (isEmpty(seller.name)) errors.push("Izdajatelj: manjka naziv.");
    if (isEmpty(seller.vat || seller.taxId)) {
      errors.push("Izdajatelj: manjka davčna številka.");
    }
    if (!isEmpty(seller.vat) && !isValidVatOrTaxIdentifier(seller.vat, seller.country)) {
      errors.push("Izdajatelj: VAT ID ni veljaven za navedeno državo.");
    }
    if (!isEmpty(seller.taxId) && !isValidVatOrTaxIdentifier(seller.taxId, seller.country)) {
      errors.push("Izdajatelj: davčna številka ni veljavna za navedeno državo.");
    }
    if (isEmpty(seller.street || seller.address)) errors.push("Izdajatelj: manjka naslov.");
    if (isEmpty(seller.postCode)) errors.push("Izdajatelj: manjka poštna številka za BG-5.");
    if (isEmpty(seller.city)) errors.push("Izdajatelj: manjka mesto za BG-5.");
    if (isEmpty(seller.country)) errors.push("Izdajatelj: manjka država.");
    if (isEmpty(seller.eLocation)) errors.push("Izdajatelj: manjka eLokacija.");
    if (isEmpty(seller.eAddress)) errors.push("Izdajatelj: manjka eAddress.");
    if (hasStandardRatedVatLine && isEmpty(seller.vat || seller.taxId)) {
      errors.push("BR-S-2: pri standardni DDV kategoriji S manjka prodajalčev DDV ali davčni identifikator.");
    }
    if (invoiceHasHrContext(invoice) && !isHrVat(seller.vat || seller.taxId)) {
      errors.push("Izdajatelj: HR VAT ID mora biti HR + 11 številk.");
    }
    if (invoiceHasHrContext(invoice) && !isOib(seller.oib || seller.vat || seller.taxId)) {
      errors.push("Izdajatelj: manjka veljaven OIB z 11 številkami.");
    }
  }

  if (!buyer) {
    errors.push("Manjka kupec računa.");
  } else {
    if (isEmpty(buyer.name)) errors.push("Kupec: manjka naziv.");
    if (isEmpty(buyer.vat || buyer.taxId)) errors.push("Kupec: manjka davčna številka.");
    if (!isEmpty(buyer.vat) && !isValidVatOrTaxIdentifier(buyer.vat, buyer.country)) {
      errors.push("Kupec: VAT ID ni veljaven za navedeno državo.");
    }
    if (!isEmpty(buyer.taxId) && !isValidVatOrTaxIdentifier(buyer.taxId, buyer.country)) {
      errors.push("Kupec: davčna številka ni veljavna za navedeno državo.");
    }
    if (isEmpty(buyer.street || buyer.address)) errors.push("Kupec: manjka naslov.");
    if (isEmpty(buyer.postCode)) warnings.push("Kupec: manjka poštna številka.");
    if (isEmpty(buyer.city)) warnings.push("Kupec: manjka mesto.");
    if (isEmpty(buyer.country)) errors.push("Kupec: manjka država.");
    if (isEmpty(buyer.eLocation)) errors.push("Kupec: manjka eLokacija.");
    if (isEmpty(buyer.eAddress)) warnings.push("Kupec: manjka eAddress, uporabljen bo fallback iz davčne številke.");
    if (invoiceHasHrContext(invoice) && !isHrVat(buyer.vat || buyer.taxId)) {
      errors.push("Kupec: HR VAT ID mora biti HR + 11 številk.");
    }
    if (invoiceHasHrContext(invoice) && !isOib(buyer.oib || buyer.vat || buyer.taxId)) {
      errors.push("Kupec: manjka veljaven OIB z 11 številkami.");
    }
  }

  if (invoiceHasHrContext(invoice)) {
    if (!isOib(invoice.operator?.oib)) {
      errors.push("Za HR e-račun manjka OIB operaterja z 11 številkami.");
    }
    if (isEmpty(invoice.operator?.code || invoice.operator?.name)) {
      errors.push("Za HR e-račun manjka oznaka operaterja.");
    }
  }

  if (!invoice.lines || invoice.lines.length === 0) {
    errors.push("Račun mora imeti vsaj eno postavko.");
  } else {
    invoice.lines.forEach((line, index) => {
      const result = validateLine(line, index, invoice);
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

    const payable = invoice.totals.payable ?? invoice.totals.gross;
    if (payable > 0 && isEmpty(invoice.dueDate)) {
      errors.push("Rok plačila je obvezen, ker je znesek za plačilo večji od 0.");
    }
  }

  const vatBreakdown = invoice.vatBreakdown || [];
  const expectedBreakdown = new Map<string, { taxableAmount: number; vatAmount: number }>();

  for (const line of invoice.lines || []) {
    const key = `${line.vatCategory || "S"}_${Number(line.vatRate || 0)}`;
    const current = expectedBreakdown.get(key) || { taxableAmount: 0, vatAmount: 0 };
    current.taxableAmount = round2(current.taxableAmount + expectedLineNet(line));
    current.vatAmount = round2(current.vatAmount + expectedLineVat(line));
    expectedBreakdown.set(key, current);
  }

  for (const [key, expected] of expectedBreakdown) {
    const [vatCategory, vatRate] = key.split("_");
    const actual = vatBreakdown.find(
      (breakdown) =>
        breakdown.vatCategory === vatCategory &&
        Number(breakdown.vatRate || 0) === Number(vatRate)
    );

    if (!actual) {
      errors.push(`Manjka DDV breakdown za kategorijo ${vatCategory} in stopnjo ${vatRate}.`);
      continue;
    }

    if (Math.abs(round2(actual.taxableAmount) - expected.taxableAmount) > 0.01) {
      errors.push(`DDV breakdown ${vatCategory}/${vatRate}: davčna osnova ni pravilna.`);
    }

    if (Math.abs(round2(actual.vatAmount) - expected.vatAmount) > 0.01) {
      errors.push(`DDV breakdown ${vatCategory}/${vatRate}: DDV znesek ni pravilen.`);
    }
  }

  const calculatedVatTotal = round2(vatBreakdown.reduce((sum, item) => sum + item.vatAmount, 0));
  if (invoice.totals && Math.abs(calculatedVatTotal - round2(invoice.totals.vat)) > 0.01) {
    errors.push("BT-110: skupni DDV ni enak vsoti DDV breakdown vrstic.");
  }

  const payment = invoice.payment;
  const iban = payment?.iban || payment?.bankAccount || invoice.bankAccount;
  const reference = payment?.reference || invoice.reference;
  const paymentMeansCode =
    payment?.paymentMeansCode || invoice.paymentMeansCode || invoice.eSlog?.paymentMeansCode;

  if (isEmpty(iban)) {
    errors.push("BT-84: manjka IBAN prodajalca.");
  } else if (!isValidIban(iban)) {
    errors.push("BT-84: IBAN prodajalca ni v veljavnem formatu ali nima pravilne kontrolne številke.");
  }

  if (iban && !(payment?.bic || payment?.bankBic || invoice.bankBic)) {
    warnings.push("BT-86: manjka BIC/SWIFT banke prejemnika; XML ga bo izpustil, če ni na voljo.");
  }

  if (isEmpty(reference)) {
    errors.push("BT-89: manjka sklic oziroma referenca plačila.");
  } else if (!isValidPaymentReference(reference)) {
    errors.push("BT-89: sklic plačila mora vsebovati od 1 do 140 znakov brez kontrolnih znakov.");
  }

  if (isEmpty(paymentMeansCode)) {
    errors.push("BT-81: manjka koda načina plačila.");
  } else if (!/^[1-9]\d{0,2}$/.test(normalize(paymentMeansCode))) {
    errors.push("BT-81: koda načina plačila mora biti veljavna številčna koda UNTDID 4461.");
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
