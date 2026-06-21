import type { InvoiceProfile, VatCategory } from "../types/invoice";

export const INVOICE_UNIT_OPTIONS = [
  { value: "H87", label: "Kos" },
  { value: "HUR", label: "Ura" },
  { value: "DAY", label: "Dan" },
  { value: "MON", label: "Mesec" },
  { value: "KGM", label: "Kilogram" },
  { value: "MTR", label: "Meter" },
  { value: "LTR", label: "Liter" },
  { value: "E48", label: "Storitev" },
  { value: "XPK", label: "Paket" },
  { value: "SET", label: "Komplet" },
] as const;

export const VAT_CATEGORY_OPTIONS: Array<{ value: VatCategory; label: string }> = [
  { value: "S", label: "Standardna stopnja" },
  { value: "Z", label: "Ničelna stopnja" },
  { value: "E", label: "Oproščeno DDV" },
  { value: "AE", label: "Obrnjena davčna obveznost" },
  { value: "G", label: "Izvoz" },
  { value: "O", label: "Ni predmet DDV" },
  { value: "K", label: "Dobava znotraj EU" },
  { value: "IC", label: "Dobava blaga znotraj EU" },
];

export const PAYMENT_MEANS_OPTIONS = [
  { value: "58", label: "SEPA kreditni transfer" },
  { value: "10", label: "Gotovina" },
  { value: "48", label: "Kartica" },
  { value: "1", label: "Drugo" },
] as const;

export const PURPOSE_CODE_OPTIONS = [
  { value: "OTHR", label: "Drugo" },
  { value: "SUPP", label: "Plačilo dobavitelju" },
  { value: "SCVE", label: "Storitve" },
  { value: "GDDS", label: "Blago" },
  { value: "TAXS", label: "Davki" },
  { value: "GOVT", label: "Plačilo državi/javnemu sektorju" },
] as const;

export function invoiceProfileDefaults(profile: InvoiceProfile) {
  return {
    paymentMeansCode: "58",
    purposeCode: "OTHR",
    line: {
      unit: "H87",
      vatCategory: "S" as VatCategory,
      vatRate: profile === "hr" ? 25 : 22,
    },
  };
}
