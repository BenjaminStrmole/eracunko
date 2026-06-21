import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const root = process.cwd();
const outDir = "/private/tmp/eracunko-onboarding-test";
rmSync(outDir, { recursive: true, force: true });

execFileSync(
  "npx",
  [
    "tsc",
    "--outDir",
    outDir,
    "--module",
    "commonjs",
    "--target",
    "ES2021",
    "--moduleResolution",
    "node",
    "--esModuleInterop",
    "--skipLibCheck",
    "lib/onboarding/invoiceFieldRules.ts",
    "lib/invoiceSmartDefaults.ts",
    "lib/client/recipientEligibility.ts",
    "lib/invoiceCodeLists.ts",
  ],
  { cwd: root, stdio: "inherit" }
);

const requireFromTmp = createRequire(join(outDir, "index.js"));
const { getInvoiceFieldIssues } = requireFromTmp(
  join(outDir, "lib/onboarding/invoiceFieldRules.js")
);
const {
  applyELocationSuggestion,
  suggestELocation,
  suggestVatRate,
  vatRateWarning,
} = requireFromTmp(join(outDir, "lib/invoiceSmartDefaults.js"));
const {
  mapRecipientLookupResponse,
  recipientLookupIdentifier,
  recipientStatusMeta,
} = requireFromTmp(join(outDir, "lib/client/recipientEligibility.js"));
const {
  INVOICE_UNIT_OPTIONS,
  invoiceProfileDefaults,
  PAYMENT_MEANS_OPTIONS,
  PURPOSE_CODE_OPTIONS,
  VAT_CATEGORY_OPTIONS,
} = requireFromTmp(join(outDir, "lib/invoiceCodeLists.js"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function issueCodes(invoice) {
  return getInvoiceFieldIssues(invoice).map((issue) => issue.code);
}

function validInvoice(profile = "standard") {
  return {
    profile,
    number: "1-PP01-01",
    invoiceNumberNumericPart: "1",
    issueDate: "2026-06-18",
    serviceDate: "2026-06-18",
    dueDate: "2026-07-03",
    currency: "EUR",
    seller: {
      name: "Prodajalec d.o.o.",
      vat: "SI12345678",
      address: "Glavna 1",
      street: "Glavna 1",
      postCode: "1000",
      city: "Ljubljana",
      country: "SI",
      eLocation: "SI12345678",
      eAddress: "SI12345678",
    },
    buyer: {
      name: "Kupec d.o.o.",
      vat: "SI87654321",
      address: "Trg 2",
      street: "Trg 2",
      country: "SI",
      eLocation: "SI87654321",
      eAddress: "SI87654321",
    },
    payment: {
      iban: "SI56191000000123456",
      bic: "SZKBSI2X",
      reference: "SI00-1",
      paymentMeansCode: "58",
      purposeCode: "OTHR",
    },
    references: {},
    lines: [
      {
        id: 1,
        description: "Storitev",
        quantity: 1,
        unit: "H87",
        price: 100,
        vatCategory: "S",
        vatRate: 22,
      },
    ],
    totals: { net: 100, vat: 22, gross: 122 },
  };
}

const standard = validInvoice();
assert(issueCodes(standard).length === 0, "Valid Standard invoice should be skipped completely");

for (const profile of ["standard", "ujp", "hr", "bank"]) {
  const emptyLinesInvoice = validInvoice(profile);
  emptyLinesInvoice.lines = [];
  const emptyLinesIssue = getInvoiceFieldIssues(emptyLinesInvoice).find(
    (issue) => issue.code === "invoice.lines.required"
  );
  assert(emptyLinesIssue, `${profile} must require at least one line item`);
  assert(emptyLinesIssue.wizardStep === 2, "Missing lines must block the Postavke step");
  assert(emptyLinesIssue.fieldId === "invoice.lines.add", "Missing lines must target the add-line button");
}

const incompleteLines = validInvoice();
incompleteLines.lines = [
  {
    id: 11,
    description: "",
    quantity: 0,
    unit: "",
    price: Number.NaN,
    vatCategory: "",
    vatRate: Number.NaN,
  },
  {
    id: 22,
    description: "Veljavna druga postavka",
    quantity: 1,
    unit: "H87",
    price: 20,
    vatCategory: "S",
    vatRate: 22,
  },
];
const incompleteLineIssues = getInvoiceFieldIssues(incompleteLines);
const expectedNewLineFields = ["description", "quantity", "unit", "price", "vatCategory", "vatRate"];
for (const field of expectedNewLineFields) {
  const lineIssue = incompleteLineIssues.find((issue) => issue.code === `lines.11.${field}`);
  assert(lineIssue, `First line must require ${field}`);
  assert(lineIssue.lineId === 11, `${field} issue must identify its line`);
  assert(lineIssue.wizardStep === 2, `${field} must remain on Postavke`);
  assert(lineIssue.fieldId === `lines.11.${field}`, `${field} must target its rendered input`);
}
assert(
  incompleteLineIssues
    .filter((issue) => issue.lineId === 11)
    .map((issue) => issue.code)
    .join(",") === expectedNewLineFields.map((field) => `lines.11.${field}`).join(","),
  "A newly added line must be queued in field order"
);
assert(
  !incompleteLineIssues.some((issue) => issue.code.startsWith("lines.22.")),
  "Already valid lines must be skipped"
);

const zeroVatLine = validInvoice();
zeroVatLine.lines[0].vatCategory = "E";
zeroVatLine.lines[0].vatRate = 22;
zeroVatLine.lines[0].taxExemptionReason = "Oproščeno po predpisu";
assert(
  issueCodes(zeroVatLine).includes("lines.1.vatRate"),
  "Zero-rated VAT categories must require a zero VAT rate"
);
zeroVatLine.lines[0].vatRate = 0;
zeroVatLine.lines[0].taxExemptionReason = "";
assert(
  issueCodes(zeroVatLine).includes("lines.1.taxExemptionReason"),
  "Special VAT categories must require an exemption reason"
);

const ujp = validInvoice("ujp");
assert(issueCodes(ujp).includes("ujp.documentReference"), "UJP must require one document reference");
ujp.references.contractReference = "POG-1";
assert(!issueCodes(ujp).includes("ujp.documentReference"), "One UJP reference must satisfy the group rule");

const bank = validInvoice("bank");
bank.references.orderReference = "NAR-1";
bank.payment.paymentPurpose = "Plačilo računa";
bank.bankData = { paymentModel: "SI00", payeeIban: bank.payment.iban, payeeBic: bank.payment.bic };
assert(issueCodes(bank).length === 0, "Valid Bank invoice should have no field issues");
bank.bankData.payeeIban = "bad";
assert(issueCodes(bank).includes("bank.iban"), "Bank profile must reject an invalid IBAN");

const hr = validInvoice("hr");
hr.hrData = {
  businessProcessType: "P1",
  issueTime: "12:30:00",
  operatorOib: "12345678901",
  operatorCode: "OP1",
};
hr.lines = [
  { ...hr.lines[0], id: 10, kpdCode: "62.01.11", hrVatCategoryCode: "S" },
  { ...hr.lines[0], id: 20, description: "Druga storitev", kpdCode: "", hrVatCategoryCode: "" },
];
const hrCodes = issueCodes(hr);
assert(hrCodes.includes("lines.20.kpdCode"), "HR must validate KPD per line");
assert(!hrCodes.includes("lines.20.hrVatCategoryCode"), "HR standard VAT must not require a special category code");
assert(!hrCodes.includes("lines.10.kpdCode"), "Valid HR line fields must be skipped");

assert(
  suggestVatRate({ profile: "standard", category: "S", currentRate: Number.NaN, manuallyChanged: false }) === 22,
  "SI Standard profile must suggest 22% VAT"
);
assert(
  suggestVatRate({ profile: "hr", category: "S", currentRate: Number.NaN, manuallyChanged: false }) === 25,
  "HR profile must suggest 25% VAT"
);
for (const category of ["Z", "E", "AE"]) {
  assert(
    suggestVatRate({ profile: "standard", category, currentRate: Number.NaN, manuallyChanged: false }) === 0,
    `${category} must suggest 0% VAT`
  );
}
assert(
  suggestVatRate({ profile: "hr", category: "S", currentRate: 13, manuallyChanged: true }) === 13,
  "A manually entered VAT rate must never be overwritten"
);
assert(
  vatRateWarning("hr", "S", 22).includes("25 %"),
  "Unexpected HR standard VAT must show a 25% hint"
);
assert(
  vatRateWarning("standard", "Z", 22).includes("0 %"),
  "Unexpected zero-category VAT must show a 0% hint"
);

const siLocation = suggestELocation("SI12345678", "SI");
assert(siLocation?.value === "SI12345678" && siLocation.schemeId === "9949", "SI VAT must suggest scheme 9949");
const hrLocation = suggestELocation("HR12345678901", "HR");
assert(hrLocation?.value === "12345678901" && hrLocation.schemeId === "9934", "HR OIB must suggest scheme 9934");
assert(
  applyELocationSuggestion("ROČNI-VNOS", siLocation) === "ROČNI-VNOS",
  "An e-location suggestion must not overwrite manual input"
);
assert(
  applyELocationSuggestion("ROČNI-VNOS", siLocation, true) === "SI12345678",
  "A confirmed e-location suggestion may replace manual input"
);

assert(
  recipientLookupIdentifier({ eLocation: "12345678901", country: "HR" }) === "HR12345678901",
  "Recipient lookup must accept an HR e-location without a VAT prefix"
);
const enabledRecipient = mapRecipientLookupResponse(
  { success: true, status: "READY", customer: { eLocation: "C:SI12345678" } },
  "SI12345678"
);
assert(enabledRecipient.status === "enabled", "READY lookup must show recipient as enabled");
assert(recipientStatusMeta(enabledRecipient.status).icon === "🟢", "Enabled recipient must have a green status");
const disabledRecipient = mapRecipientLookupResponse(
  { success: false, status: "NOT_REGISTERED" },
  "SI12345678"
);
assert(disabledRecipient.status === "disabled", "Missing recipient registration must show a red status");
assert(recipientStatusMeta(disabledRecipient.status).icon === "🔴", "Disabled recipient must have a red status");
const unavailableRecipient = mapRecipientLookupResponse({ success: false }, "SI12345678");
assert(unavailableRecipient.status === "unavailable", "Failed lookup must show an unavailable status");
assert(recipientStatusMeta(unavailableRecipient.status).icon === "🟡", "Unavailable lookup must have a yellow status");

const invoicePageSource = readFileSync(join(root, "app/invoices/new/page.tsx"), "utf8");
assert(invoicePageSource.includes("Preveri prejemnika"), "Invoice wizard must render the recipient check button");
assert(invoicePageSource.includes("RecipientStatus check={recipientCheck}"), "Invoice wizard must render the lookup status");
const previewPageSource = readFileSync(join(root, "app/invoices/preview/page.tsx"), "utf8");
assert(previewPageSource.includes("invoice.recipientCheck"), "Invoice preview must render the saved recipient status");

assert(INVOICE_UNIT_OPTIONS.find((option) => option.label === "Kos")?.value === "H87", "Kos selection must store H87");
assert(VAT_CATEGORY_OPTIONS.find((option) => option.label === "Standardna stopnja")?.value === "S", "Standard VAT selection must store S");
assert(PAYMENT_MEANS_OPTIONS.find((option) => option.label === "SEPA kreditni transfer")?.value === "58", "SEPA selection must store 58");
assert(PURPOSE_CODE_OPTIONS.find((option) => option.label === "Drugo")?.value === "OTHR", "Other purpose selection must store OTHR");
const ujpDefaults = invoiceProfileDefaults("ujp");
assert(ujpDefaults.paymentMeansCode === "58", "UJP must default to SEPA credit transfer");
assert(ujpDefaults.purposeCode === "OTHR", "UJP must default to OTHR");
assert(ujpDefaults.line.unit === "H87", "UJP line must default to H87");
assert(ujpDefaults.line.vatCategory === "S", "UJP line must default to standard VAT");
assert(ujpDefaults.line.vatRate === 22, "UJP line must default to 22% VAT");
assert(invoicePageSource.includes("INVOICE_UNIT_OPTIONS.map"), "Invoice unit must render as a dropdown");
assert(invoicePageSource.includes("PAYMENT_MEANS_OPTIONS.map"), "Payment means must render as a dropdown");
assert(invoicePageSource.includes("PURPOSE_CODE_OPTIONS.map"), "Purpose code must render as a dropdown");

console.log("Field wizard registry tests passed.");
