import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
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
  ],
  { cwd: root, stdio: "inherit" }
);

const requireFromTmp = createRequire(join(outDir, "index.js"));
const { getInvoiceFieldIssues } = requireFromTmp(
  join(outDir, "lib/onboarding/invoiceFieldRules.js")
);

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
    vatCategory: "S",
    vatRate: 0,
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
for (const field of ["description", "quantity", "unit", "price", "vatRate"]) {
  const lineIssue = incompleteLineIssues.find((issue) => issue.code === `lines.11.${field}`);
  assert(lineIssue, `First line must require ${field}`);
  assert(lineIssue.lineId === 11, `${field} issue must identify its line`);
  assert(lineIssue.wizardStep === 2, `${field} must remain on Postavke`);
}
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
assert(hrCodes.includes("lines.20.hrVatCategoryCode"), "HR must validate VAT category per line");
assert(!hrCodes.includes("lines.10.kpdCode"), "Valid HR line fields must be skipped");

console.log("Field wizard registry tests passed.");
