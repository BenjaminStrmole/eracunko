import type { Invoice, InvoiceLine, InvoiceProfile } from "../../types/invoice";
import type { FieldRule, ValidationIssue } from "./types";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function issue(
  rule: Pick<FieldRule, "id" | "target">,
  message: string,
  lineId?: number
): ValidationIssue {
  return {
    code: rule.id,
    ...rule.target,
    message,
    severity: "error",
    lineId,
  };
}

function rule(
  definition: Omit<FieldRule, "validate"> & {
    check: (invoice: Invoice) => boolean;
    message: string;
  }
): FieldRule {
  const { check, message, ...fieldRule } = definition;
  return {
    ...fieldRule,
    validate: (invoice) => (check(invoice) ? null : issue(fieldRule, message)),
  };
}

function validDate(value: unknown) {
  return /^\d{4}-\d{2}-\d{2}$/.test(text(value));
}

function validTime(value: unknown) {
  return /^\d{2}:\d{2}:\d{2}$/.test(text(value));
}

function validOib(value: unknown) {
  return /^\d{11}$/.test(text(value).replace(/\D/g, ""));
}

function validIban(value: unknown) {
  return /^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(
    text(value).replace(/\s/g, "").toUpperCase()
  );
}

function hasDocumentReference(invoice: Invoice) {
  return Boolean(
    text(invoice.references?.orderReference) ||
      text(invoice.ujpData?.orderReference) ||
      text(invoice.references?.contractReference) ||
      text(invoice.ujpData?.contractReference) ||
      text(invoice.references?.deliveryNoteReference) ||
      text(invoice.ujpData?.deliveryNoteReference)
  );
}

function sellerMissingFields(invoice: Invoice) {
  const seller = invoice.seller;
  if (!seller) return ["aktivno podjetje"];

  return [
    !text(seller.name) && "naziv",
    !text(seller.vat || seller.taxId) && "davčna številka",
    !text(seller.street || seller.address) && "naslov",
    !text(seller.postCode) && "poštna številka",
    !text(seller.city) && "mesto",
    !text(seller.country) && "država",
    !text(seller.eLocation) && "eLokacija",
    !text(seller.eAddress) && "eAddress",
  ].filter(Boolean) as string[];
}

const baseRules: FieldRule[] = [
  {
    id: "seller.settings",
    profiles: ["all"],
    target: { fieldId: "seller.settings", wizardStep: 0, actionRoute: "/settings" },
    label: "Podatki prodajalca",
    instruction: "Dopolni podatke aktivnega podjetja v Nastavitvah.",
    scope: "base",
    validate(invoice) {
      const missing = sellerMissingFields(invoice);
      return missing.length
        ? issue(this, `V Nastavitvah dopolni podatke prodajalca: ${missing.join(", ")}.`)
        : null;
    },
  },
  rule({
    id: "buyer.name",
    profiles: ["all"],
    target: { fieldId: "buyer.name", wizardStep: 0 },
    label: "Naziv kupca",
    instruction: "Vnesi uradni naziv kupca.",
    scope: "base",
    check: (invoice) => Boolean(text(invoice.buyer?.name)),
    message: "Naziv kupca je obvezen.",
  }),
  rule({
    id: "buyer.vat",
    profiles: ["all"],
    target: { fieldId: "buyer.vat", wizardStep: 0 },
    label: "Davčna številka kupca",
    instruction: "Vnesi davčno številko oziroma OIB kupca.",
    scope: "base",
    check: (invoice) => Boolean(text(invoice.buyer?.vat || invoice.buyer?.taxId)),
    message: "Davčna številka kupca je obvezna.",
  }),
  rule({
    id: "buyer.address",
    profiles: ["all"],
    target: { fieldId: "buyer.address", wizardStep: 0 },
    label: "Naslov kupca",
    instruction: "Vnesi ulico in hišno številko kupca.",
    scope: "base",
    check: (invoice) => Boolean(text(invoice.buyer?.street || invoice.buyer?.address)),
    message: "Naslov kupca je obvezen.",
  }),
  rule({
    id: "buyer.country",
    profiles: ["all"],
    target: { fieldId: "buyer.country", wizardStep: 0 },
    label: "Država kupca",
    instruction: "Vnesi dvočrkovno oznako države, na primer SI.",
    scope: "base",
    check: (invoice) => /^[A-Z]{2}$/.test(text(invoice.buyer?.country).toUpperCase()),
    message: "Država kupca mora biti dvočrkovna oznaka, na primer SI.",
  }),
  rule({
    id: "buyer.eLocation",
    profiles: ["all"],
    target: { fieldId: "buyer.eLocation", wizardStep: 0 },
    label: "eLokacija kupca",
    instruction: "Vnesi elektronsko lokacijo prejemnika v omrežju eSLOG/bizBox.",
    scope: "base",
    check: (invoice) => Boolean(text(invoice.buyer?.eLocation)),
    message: "eLokacija kupca je obvezna za elektronsko dostavo.",
  }),
  rule({
    id: "invoice.number",
    profiles: ["all"],
    target: { fieldId: "invoice.number", wizardStep: 1 },
    label: "Številka računa",
    instruction: "Vnesi zaporedni del številke računa.",
    scope: "base",
    check: (invoice) => Boolean(text(invoice.invoiceNumberNumericPart || invoice.number)),
    message: "Številka računa je obvezna.",
  }),
  ...(["issueDate", "serviceDate", "dueDate"] as const).map((name) =>
    rule({
      id: `invoice.${name}`,
      profiles: ["all"],
      target: { fieldId: `invoice.${name}`, wizardStep: 1 },
      label:
        name === "issueDate"
          ? "Datum izdaje"
          : name === "serviceDate"
            ? "Datum storitve"
            : "Rok plačila",
      instruction: "Izberi veljaven datum.",
      scope: "base",
      check: (invoice) => validDate(invoice[name]),
      message: "Vnesi veljaven datum.",
    })
  ),
  rule({
    id: "payment.iban",
    profiles: ["all"],
    target: { fieldId: "payment.iban", wizardStep: 1 },
    label: "IBAN",
    instruction: "Vnesi IBAN računa, na katerega bo kupec nakazal plačilo.",
    scope: "base",
    check: (invoice) => Boolean(text(invoice.payment?.iban || invoice.bankAccount)),
    message: "IBAN oziroma bančni račun je obvezen.",
  }),
  rule({
    id: "payment.reference",
    profiles: ["all"],
    target: { fieldId: "payment.reference", wizardStep: 1 },
    label: "Sklic plačila",
    instruction: "Vnesi sklic, ki poveže plačilo z računom.",
    scope: "base",
    check: (invoice) => Boolean(text(invoice.payment?.reference || invoice.reference)),
    message: "Sklic plačila je obvezen.",
  }),
  rule({
    id: "payment.paymentMeansCode",
    profiles: ["all"],
    target: { fieldId: "payment.paymentMeansCode", wizardStep: 1 },
    label: "Način plačila",
    instruction: "Izberi način plačila.",
    scope: "base",
    check: (invoice) => Boolean(text(invoice.payment?.paymentMeansCode || invoice.paymentMeansCode)),
    message: "Način plačila je obvezen.",
  }),
];

function documentReferenceRule(profile: "ujp" | "bank"): FieldRule {
  return rule({
    id: `${profile}.documentReference`,
    profiles: [profile],
    target: { fieldId: "references.document", wizardStep: 1 },
    label: "Referenca dokumenta",
    instruction: "Vnesi naročilo, pogodbo ali dobavnico. Zadostuje ena referenca.",
    scope: "profile",
    check: hasDocumentReference,
    message: `${profile === "ujp" ? "UJP" : "Banka"}: vnesi vsaj eno referenco: naročilo, pogodbo ali dobavnico.`,
  });
}

const profileRules: FieldRule[] = [
  documentReferenceRule("ujp"),
  documentReferenceRule("bank"),
  rule({
    id: "bank.iban",
    profiles: ["bank"],
    target: { fieldId: "payment.iban", wizardStep: 1 },
    label: "Veljaven IBAN",
    instruction: "Za bančni profil vnesi veljaven IBAN brez napačnih znakov.",
    scope: "profile",
    check: (invoice) => validIban(invoice.bankData?.payeeIban || invoice.payment?.iban || invoice.bankAccount),
    message: "Banka: IBAN ni v veljavnem formatu.",
  }),
  rule({
    id: "bank.bic",
    profiles: ["bank"],
    target: { fieldId: "payment.bic", wizardStep: 1 },
    label: "BIC/SWIFT",
    instruction: "Vnesi BIC oziroma SWIFT banke prejemnika.",
    scope: "profile",
    check: (invoice) => Boolean(text(invoice.bankData?.payeeBic || invoice.payment?.bic || invoice.bankBic)),
    message: "Banka: BIC/SWIFT je obvezen.",
  }),
  rule({
    id: "bank.purposeCode",
    profiles: ["bank"],
    target: { fieldId: "payment.purposeCode", wizardStep: 1 },
    label: "Koda namena",
    instruction: "Vnesi kodo namena plačila.",
    scope: "profile",
    check: (invoice) => Boolean(text(invoice.bankData?.purposeCode || invoice.payment?.purposeCode || invoice.purposeCode)),
    message: "Banka: koda namena je obvezna.",
  }),
  rule({
    id: "bank.paymentModel",
    profiles: ["bank"],
    target: { fieldId: "profile.bank.paymentModel", wizardStep: 1 },
    label: "Model plačila",
    instruction: "Vnesi model plačila, na primer SI00.",
    scope: "profile",
    check: (invoice) => Boolean(text(invoice.bankData?.paymentModel)),
    message: "Banka: model plačila je obvezen.",
  }),
  rule({
    id: "hr.businessProcessType",
    profiles: ["hr"],
    target: { fieldId: "profile.hr.businessProcessType", wizardStep: 1 },
    label: "HR poslovni proces",
    instruction: "Izberi proces P1-P12 ali P99.",
    scope: "profile",
    check: (invoice) => /^P([1-9]|1[0-2]|99)$/.test(text(invoice.hrData?.businessProcessType || invoice.businessProcess)),
    message: "HR: poslovni proces mora biti P1-P12 ali P99.",
  }),
  rule({
    id: "hr.p99BuyerProcessId",
    profiles: ["hr"],
    target: { fieldId: "profile.hr.p99BuyerProcessId", wizardStep: 1 },
    label: "Kupčeva oznaka procesa",
    instruction: "Pri procesu P99 vnesi oznako, ki jo je določil kupec.",
    scope: "profile",
    check: (invoice) =>
      text(invoice.hrData?.businessProcessType || invoice.businessProcess) !== "P99" ||
      Boolean(text(invoice.hrData?.p99BuyerProcessId)),
    message: "HR: pri procesu P99 je kupčeva oznaka procesa obvezna.",
  }),
  rule({
    id: "hr.issueTime",
    profiles: ["hr"],
    target: { fieldId: "profile.hr.issueTime", wizardStep: 1 },
    label: "Čas izdaje",
    instruction: "Vnesi čas izdaje v formatu HH:MM:SS.",
    scope: "profile",
    check: (invoice) => validTime(invoice.hrData?.issueTime || invoice.issueTime),
    message: "HR: čas izdaje mora biti v formatu HH:MM:SS.",
  }),
  rule({
    id: "hr.operatorOib",
    profiles: ["hr"],
    target: { fieldId: "profile.hr.operatorOib", wizardStep: 1 },
    label: "OIB operaterja",
    instruction: "Vnesi 11-mestni OIB operaterja.",
    scope: "profile",
    check: (invoice) => validOib(invoice.hrData?.operatorOib || invoice.operator?.oib),
    message: "HR: OIB operaterja mora imeti 11 številk.",
  }),
  rule({
    id: "hr.operatorCode",
    profiles: ["hr"],
    target: { fieldId: "profile.hr.operatorCode", wizardStep: 1 },
    label: "Oznaka operaterja",
    instruction: "Vnesi oznako operaterja, ki je izdal račun.",
    scope: "profile",
    check: (invoice) => Boolean(text(invoice.hrData?.operatorCode || invoice.operator?.code)),
    message: "HR: oznaka operaterja je obvezna.",
  }),
  rule({
    id: "hr.previousInvoiceDate",
    profiles: ["hr"],
    target: { fieldId: "profile.hr.previousInvoiceDate", wizardStep: 1 },
    label: "Datum predhodnega računa",
    instruction: "Če si navedel predhodni račun, vnesi tudi njegov datum.",
    scope: "profile",
    check: (invoice) =>
      !text(invoice.hrData?.previousInvoiceNumber) || validDate(invoice.hrData?.previousInvoiceDate),
    message: "HR: pri predhodnem računu je datum obvezen.",
  }),
  rule({
    id: "hr.buyerEAddress",
    profiles: ["hr"],
    target: { fieldId: "buyer.eAddress", wizardStep: 0 },
    label: "Elektronski naslov kupca",
    instruction: "Za HR račun vnesi elektronski naslov kupca iz AMS.",
    scope: "profile",
    check: (invoice) => Boolean(text(invoice.buyer?.eAddress)),
    message: "HR: kupec mora imeti elektronski naslov iz AMS.",
  }),
];

function lineRules(line: InvoiceLine, profile: InvoiceProfile): FieldRule[] {
  const prefix = `lines.${line.id}`;
  const common: FieldRule[] = [
    rule({
      id: `${prefix}.description`, profiles: ["all"],
      target: { fieldId: `${prefix}.description`, wizardStep: 2 },
      label: "Opis postavke", instruction: "Vnesi naziv ali opis postavke.", scope: "base",
      check: () => Boolean(text(line.description)), message: "Postavka potrebuje opis.",
    }),
    rule({
      id: `${prefix}.quantity`, profiles: ["all"],
      target: { fieldId: `${prefix}.quantity`, wizardStep: 2 },
      label: "Količina", instruction: "Vnesi količino, večjo od 0.", scope: "base",
      check: () => Number.isFinite(line.quantity) && line.quantity > 0, message: "Količina mora biti večja od 0.",
    }),
    rule({
      id: `${prefix}.unit`, profiles: ["all"],
      target: { fieldId: `${prefix}.unit`, wizardStep: 2 },
      label: "Enota mere", instruction: "Vnesi enoto mere, na primer H87.", scope: "base",
      check: () => Boolean(text(line.unit)), message: "Enota mere je obvezna.",
    }),
    rule({
      id: `${prefix}.price`, profiles: ["all"],
      target: { fieldId: `${prefix}.price`, wizardStep: 2 },
      label: "Neto cena", instruction: "Vnesi veljavno neto ceno.", scope: "base",
      check: () => Number.isFinite(line.price) && line.price >= 0, message: "Cena mora biti veljavno nenegativno število.",
    }),
    rule({
      id: `${prefix}.vatCategory`, profiles: ["all"],
      target: { fieldId: `${prefix}.vatCategory`, wizardStep: 2 },
      label: "DDV kategorija", instruction: "Izberi ustrezno DDV kategorijo.", scope: "base",
      check: () => Boolean(line.vatCategory), message: "DDV kategorija je obvezna.",
    }),
    rule({
      id: `${prefix}.vatRate`, profiles: ["all"],
      target: { fieldId: `${prefix}.vatRate`, wizardStep: 2 },
      label: "DDV stopnja", instruction: "Vnesi veljavno DDV stopnjo.", scope: "base",
      check: () => Number.isFinite(line.vatRate) && line.vatRate >= 0 && (line.vatCategory !== "S" || line.vatRate > 0),
      message: "DDV stopnja ni veljavna za izbrano kategorijo.",
    }),
  ];

  if (line.vatCategory && line.vatCategory !== "S") {
    common.push(rule({
      id: `${prefix}.taxExemptionReason`, profiles: ["all"],
      target: { fieldId: `${prefix}.taxExemptionReason`, wizardStep: 2 },
      label: "Razlog davčne oprostitve", instruction: "Vnesi razlog posebne DDV obravnave.", scope: "base",
      check: () => Boolean(text(line.taxExemptionReason || line.taxExemptionReasonCode)),
      message: "Pri tej DDV kategoriji je razlog oprostitve obvezen.",
    }));
  }

  if (profile === "hr") {
    common.push(
      rule({
        id: `${prefix}.kpdCode`, profiles: ["hr"],
        target: { fieldId: `${prefix}.kpdCode`, wizardStep: 2 },
        label: "KPD/CPA koda", instruction: "Vnesi KPD oziroma CPA klasifikacijsko kodo postavke.", scope: "profile",
        check: () => Boolean(text(line.kpdCode)), message: "HR: KPD/CPA koda postavke je obvezna.",
      }),
      rule({
        id: `${prefix}.hrVatCategoryCode`, profiles: ["hr"],
        target: { fieldId: `${prefix}.hrVatCategoryCode`, wizardStep: 2 },
        label: "HR DDV oznaka", instruction: "Vnesi HR oznako DDV kategorije postavke.", scope: "profile",
        check: () => Boolean(text(line.hrVatCategoryCode)), message: "HR: oznaka DDV kategorije postavke je obvezna.",
      })
    );
  }

  return common;
}

export function getInvoiceFieldRules(invoice: Invoice): FieldRule[] {
  const profile = invoice.profile || "standard";
  return [
    ...baseRules,
    ...profileRules.filter((item) => item.profiles.includes(profile)),
    ...(invoice.lines || []).flatMap((line) => lineRules(line, profile)),
  ];
}

export function getInvoiceFieldIssues(invoice: Invoice): ValidationIssue[] {
  return getInvoiceFieldRules(invoice)
    .map((item) => item.validate(invoice))
    .filter((item): item is ValidationIssue => Boolean(item));
}

export function getProfileFieldIssues(
  invoice: Invoice,
  profile: InvoiceProfile
): ValidationIssue[] {
  return getInvoiceFieldRules({ ...invoice, profile })
    .filter((item) => item.scope === "profile" && item.profiles.includes(profile))
    .map((item) => item.validate(invoice))
    .filter((item): item is ValidationIssue => Boolean(item));
}

export function getFieldRule(invoice: Invoice, code: string) {
  return getInvoiceFieldRules(invoice).find((item) => item.id === code);
}
