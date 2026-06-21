import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const projectRoot = process.cwd();
const tmpDir = "/private/tmp/eracunko-eslog-test";
const xsdPath = "/Users/benjaminstrmole/Downloads/e-SLOG-2/eSLOG20_INVOIC_v200.xsd";

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    ...options,
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNotIncludes(xml, value, message) {
  assert(!xml.includes(value), message);
}

function assertIncludes(xml, value, message) {
  assert(xml.includes(value), message);
}

function assertMatches(xml, pattern, message) {
  assert(pattern.test(xml), message);
}

function countOccurrences(value, needle) {
  return value.split(needle).length - 1;
}

rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });

run("npx", [
  "tsc",
  "--outDir",
  tmpDir,
  "--module",
  "commonjs",
  "--target",
  "ES2021",
  "--lib",
  "ES2021,DOM",
  "--moduleResolution",
  "node",
  "--esModuleInterop",
  "--skipLibCheck",
  "lib/eslog/buildEslogInvoiceXml.ts",
  "lib/eslog/prepareInvoiceForEslog.ts",
]);

const requireFromTmp = createRequire(join(tmpDir, "index.js"));
const { buildEslogInvoiceXml } = requireFromTmp(join(tmpDir, "lib/eslog/buildEslogInvoiceXml.js"));
const { prepareInvoiceForEslog } = requireFromTmp(
  join(tmpDir, "lib/eslog/prepareInvoiceForEslog.js")
);
const { invoiceProfileConfigs } = requireFromTmp(
  join(tmpDir, "lib/eslog/invoiceProfiles.js")
);
const { normalizeUnitCode } = requireFromTmp(
  join(tmpDir, "lib/eslog/unitCodes.js")
);

for (const alias of ["KOS", "kos", "pcs", "piece", "kom", "komad"]) {
  assert(normalizeUnitCode(alias) === "H87", `${alias} must normalize to H87`);
}

const hrProfileFieldNames = invoiceProfileConfigs.hr.profileFields.map((field) => field.name);
for (const fieldName of ["issueTime", "operatorOib", "operatorCode", "kpdCode"]) {
  assert(hrProfileFieldNames.includes(fieldName), `HR profile must expose ${fieldName} immediately`);
}
for (const fieldName of ["payment.iban", "payment.reference", "payment.purposeCode"]) {
  assert(invoiceProfileConfigs.ujp.requiredFields.includes(fieldName), `UJP profile must require ${fieldName}`);
}
for (const fieldName of ["payment.iban", "payment.bic", "payment.reference", "payment.paymentPurpose"]) {
  assert(invoiceProfileConfigs.bank.requiredFields.includes(fieldName), `Bank profile must require ${fieldName}`);
}

const fixtures = [
  "minimal-standard-invoice",
  "ujp-bank-oriented-invoice",
];

for (const fixtureName of fixtures) {
  const fixturePath = join(projectRoot, "fixtures/eslog", `${fixtureName}.json`);
  const invoice = JSON.parse(readFileSync(fixturePath, "utf8"));

  invoice.lines = invoice.lines.map((line, index) => ({
    ...line,
    id: index === 0 ? 1781425490564 : line.id,
  }));

  if (fixtureName === "minimal-standard-invoice") {
    invoice.seller = {
      ...invoice.seller,
      address: "Slovenska cesta 1, 1000 Ljubljana, SI",
      street: "",
      postCode: "",
      city: "",
      country: "",
    };
  }

  const xml = buildEslogInvoiceXml(invoice);
  const xmlPath = join(tmpDir, `${fixtureName}.xml`);
  writeFileSync(xmlPath, xml);

  assertIncludes(xml, "<C_C059>", `${fixtureName}: seller/buyer postal address segment missing`);
  assertIncludes(xml, "<D_3251>", `${fixtureName}: postal code missing`);
  assertIncludes(xml, "<D_3164>", `${fixtureName}: city missing`);
  assertIncludes(xml, "<D_3207>", `${fixtureName}: country missing`);
  if (fixtureName === "minimal-standard-invoice") {
    assertIncludes(xml, "<D_3042>Slovenska cesta 1</D_3042>", `${fixtureName}: seller street was not parsed from address`);
    assertIncludes(xml, "<D_3251>1000</D_3251>", `${fixtureName}: seller post code was not parsed from address`);
    assertIncludes(xml, "<D_3164>Ljubljana</D_3164>", `${fixtureName}: seller city was not parsed from address`);
    assertIncludes(xml, "<D_3207>SI</D_3207>", `${fixtureName}: seller country was not parsed from address`);
  }
  assertIncludes(xml, "<D_1153>VA</D_1153>", `${fixtureName}: seller/buyer VAT reference missing`);
  assertIncludes(xml, "<D_1082>1</D_1082>", `${fixtureName}: first line number must be sequential`);
  assertNotIncludes(xml, "1781425490564", `${fixtureName}: timestamp leaked into D_1082`);
  assertNotIncludes(xml, "<D_7009>", `${fixtureName}: invalid IMD D_7009 emitted`);
  assertNotIncludes(xml, "<D_7143>SRV</D_7143>", `${fixtureName}: internal item code emitted as standard identifier`);
  assertNotIncludes(xml, "<D_1153>GN</D_1153>", `${fixtureName}: legal registration emitted without confirmed ISO 6523 ICD scheme`);
  assertNotIncludes(xml, "<D_1131>SI</D_1131>", `${fixtureName}: invalid country code emitted as ISO 6523 ICD scheme`);
  assertNotIncludes(xml, "<D_1131>VAT</D_1131>", `${fixtureName}: invalid VAT text emitted as ISO 6523 ICD scheme`);
  assertNotIncludes(xml, "<D_1131>TAX</D_1131>", `${fixtureName}: invalid TAX text emitted as ISO 6523 ICD scheme`);
  assertNotIncludes(xml, "<D_1131>9934</D_1131>", `${fixtureName}: e-location scheme leaked into NAD identifier scheme`);

  if (existsSync(xsdPath)) {
    run("xmllint", ["--noout", "--schema", xsdPath, xmlPath]);
  }
}

const standardFixture = JSON.parse(
  readFileSync(join(projectRoot, "fixtures/eslog/minimal-standard-invoice.json"), "utf8")
);
const preparedStandard = prepareInvoiceForEslog(standardFixture);
assert(preparedStandard.validation.valid, "Valid standard SI invoice must pass validation");
assertIncludes(
  preparedStandard.xml,
  "<D_4461>58</D_4461>",
  "BT-81 payment means code must be emitted in PAI"
);
assertIncludes(
  preparedStandard.xml,
  "<D_3194>SI56191000000123438</D_3194>",
  "BT-84 seller IBAN must be emitted in FII"
);
assertMatches(
  preparedStandard.xml,
  /<D_1153>PQ<\/D_1153>[\s\S]*?<D_1154>SI00 INV20260001<\/D_1154>/,
  "BT-89 payment reference must be emitted as RFF PQ"
);
assertMatches(
  preparedStandard.xml,
  /<G_SG27>[\s\S]*?<D_5025>203<\/D_5025>[\s\S]*?<D_5004>100\.00<\/D_5004>[\s\S]*?<\/G_SG27>/,
  "BT-131 line net amount must be emitted as MOA 203"
);
assertMatches(
  preparedStandard.xml,
  /<G_SG29>[\s\S]*?<D_5125>AAA<\/D_5125>[\s\S]*?<D_5118>100\.00<\/D_5118>[\s\S]*?<\/G_SG29>/,
  "BT-146 item net price must be emitted as PRI AAA"
);
assertMatches(
  preparedStandard.xml,
  /<G_SG34>[\s\S]*?<D_5278>22\.00<\/D_5278>[\s\S]*?<D_5305>S<\/D_5305>[\s\S]*?<\/G_SG34>/,
  "BT-151 and BT-152 must be emitted for every standard-rated line"
);

const kosUnitInvoice = structuredClone(standardFixture);
kosUnitInvoice.lines[0].unit = "KOS";
kosUnitInvoice.seller.endpointSchemeId = "9934";
kosUnitInvoice.buyer.endpointSchemeId = "9934";
const kosUnitResult = prepareInvoiceForEslog(kosUnitInvoice);
assert(kosUnitResult.validation.valid, "KOS unit alias must produce a valid invoice");
assertMatches(
  kosUnitResult.xml,
  /<S_QTY>[\s\S]*?<D_6411>H87<\/D_6411>[\s\S]*?<\/S_QTY>/,
  "KOS must map to H87 for BT-130 in QTY"
);
assertMatches(
  kosUnitResult.xml,
  /<G_SG29>[\s\S]*?<S_PRI>[\s\S]*?<D_6411>H87<\/D_6411>[\s\S]*?<\/G_SG29>/,
  "KOS must map to H87 for BT-150 in PRI"
);
assertNotIncludes(
  kosUnitResult.xml,
  "<D_1131>9934</D_1131>",
  "NAD C_C082 must not use the e-location scheme as BT-29-1 or BT-46-1"
);
const kosUnitXmlPath = join(tmpDir, "unit-kos-h87.xml");
writeFileSync(kosUnitXmlPath, kosUnitResult.xml);
if (existsSync(xsdPath)) run("xmllint", ["--noout", "--schema", xsdPath, kosUnitXmlPath]);

const unknownUnitInvoice = structuredClone(standardFixture);
unknownUnitInvoice.lines[0].unit = "NOT-A-UNIT";
const unknownUnitResult = prepareInvoiceForEslog(unknownUnitInvoice);
assert(unknownUnitResult.validation.valid, "Unknown unit code must remain a warning, not a blocking error");
assert(
  unknownUnitResult.validation.warnings.some((warning) => warning.includes("UN/ECE Rec 20/21")),
  "Unknown unit code must produce a clear UN/ECE warning"
);

const referenceFixture = JSON.parse(
  readFileSync(join(projectRoot, "fixtures/eslog/reference-pra26-2446.json"), "utf8")
);
const preparedReference = prepareInvoiceForEslog(referenceFixture);
assert(
  preparedReference.validation.valid,
  `Reference PRA26-2446 invoice must be valid: ${preparedReference.validation.errors.join("; ")}`
);
assert(preparedReference.invoice.totals.net === 13597.5, "Reference BT-106 net total must be 13597.50");
assert(preparedReference.invoice.totals.vat === 2991.45, "Reference BT-110 VAT total must be 2991.45");
assert(preparedReference.invoice.totals.gross === 16588.95, "Reference BT-112 gross total must be 16588.95");

const referenceXml = preparedReference.xml;
assertMatches(referenceXml, /<S_UNH>[\s\S]*?<D_0062>PRA26-2446<\/D_0062>[\s\S]*?<\/S_UNH>/, "Reference UNH must contain invoice number");
assertMatches(referenceXml, /<S_BGM>[\s\S]*?<C_C106>[\s\S]*?<D_1004>PRA26-2446<\/D_1004>[\s\S]*?<\/S_BGM>/, "Reference BGM must contain invoice number");
assertMatches(referenceXml, /<D_2005>137<\/D_2005>[\s\S]*?<D_2380>2026-06-08<\/D_2380>/, "Reference DTM 137 must contain issue date");
assertMatches(referenceXml, /<D_2005>35<\/D_2005>[\s\S]*?<D_2380>2026-05-31<\/D_2380>/, "Reference DTM 35 must contain service date");
assertMatches(referenceXml, /<D_4451>DOC<\/D_4451>[\s\S]*?<D_4441>P1<\/D_4441>[\s\S]*?<D_4440>urn:cen\.eu:en16931:2017<\/D_4440>/, "Reference FTX DOC must contain BT-23 and BT-24");
assertMatches(referenceXml, /<D_4451>AAT<\/D_4451>[\s\S]*?Plačilo računa št\.: PRA26-2446/, "Reference payment purpose must use FTX AAT");
assertMatches(referenceXml, /<D_4451>ALQ<\/D_4451>[\s\S]*?<D_4440>OTHR<\/D_4440>/, "Reference purpose code must use FTX ALQ");
assertMatches(referenceXml, /<D_4451>PMD<\/D_4451>[\s\S]*?Plačilo računa št\.: PRA26-2446/, "Reference payment description must use FTX PMD");
assertMatches(referenceXml, /<D_1153>PQ<\/D_1153>[\s\S]*?<D_1154>SI00262446-00001<\/D_1154>/, "Reference payment reference must use RFF PQ");
assertMatches(referenceXml, /<G_SG2>[\s\S]*?<D_3035>SE<\/D_3035>[\s\S]*?<D_3036>Business Solutions d\.o\.o\.<\/D_3036>[\s\S]*?<D_1153>0199<\/D_1153>[\s\S]*?<D_1154>1482980000<\/D_1154>[\s\S]*?<\/G_SG2>/, "Reference seller must include registration number");
assertMatches(referenceXml, /<G_SG2>[\s\S]*?<D_3035>BY<\/D_3035>[\s\S]*?<D_3036>ADRIAPLIN d\.o\.o\.<\/D_3036>[\s\S]*?<D_1153>0199<\/D_1153>[\s\S]*?<D_1154>5865379000<\/D_1154>[\s\S]*?<\/G_SG2>/, "Reference buyer must include registration number");
assertNotIncludes(referenceXml, "<D_1153>API</D_1153>", "Standard SI parties must not emit Croatian OIB references");
assertMatches(referenceXml, /<G_SG8>[\s\S]*?<S_PAT>[\s\S]*?<D_4279>1<\/D_4279>[\s\S]*?<D_2005>13<\/D_2005>[\s\S]*?<D_2380>2026-07-08<\/D_2380>[\s\S]*?<S_PAI>[\s\S]*?<D_4461>1<\/D_4461>[\s\S]*?<\/G_SG8>/, "Reference payment terms group must contain PAT, due date and PAI");
assert(countOccurrences(referenceXml, "<G_SG26>") === 5, "Reference invoice must contain five line groups");
assertMatches(referenceXml, /<G_SG26>[\s\S]*?<D_1082>2<\/D_1082>[\s\S]*?<D_6060>14\.25<\/D_6060>[\s\S]*?<D_5025>203<\/D_5025>[\s\S]*?<D_5004>997\.50<\/D_5004>[\s\S]*?<G_SG29>[\s\S]*?<D_5125>AAA<\/D_5125>[\s\S]*?<D_5118>70\.00<\/D_5118>[\s\S]*?<G_SG34>[\s\S]*?<D_5278>22\.00<\/D_5278>[\s\S]*?<D_5305>S<\/D_5305>/, "Reference second line must contain correct quantity, net, BT-146, BT-151 and BT-152");
assertMatches(referenceXml, /<D_5025>79<\/D_5025>[\s\S]*?<D_5004>13597\.50<\/D_5004>[\s\S]*?<D_5025>389<\/D_5025>[\s\S]*?<D_5004>13597\.50<\/D_5004>[\s\S]*?<D_5025>176<\/D_5025>[\s\S]*?<D_5004>2991\.45<\/D_5004>[\s\S]*?<D_5025>388<\/D_5025>[\s\S]*?<D_5004>16588\.95<\/D_5004>[\s\S]*?<D_5025>9<\/D_5025>[\s\S]*?<D_5004>16588\.95<\/D_5004>/, "Reference SG50 totals must match the source invoice");
assertMatches(referenceXml, /<G_SG52>[\s\S]*?<D_5278>22\.00<\/D_5278>[\s\S]*?<D_5305>S<\/D_5305>[\s\S]*?<D_5025>125<\/D_5025>[\s\S]*?<D_5004>13597\.50<\/D_5004>[\s\S]*?<D_5025>124<\/D_5025>[\s\S]*?<D_5004>2991\.45<\/D_5004>[\s\S]*?<\/G_SG52>/, "Reference SG52 VAT summary must match calculated VAT");
assert(!/<([A-Za-z0-9_]+)>\s*<\/\1>/.test(referenceXml), "Reference-derived XML must not contain empty elements");

const topLevelOrder = ["<S_UNH>", "<S_BGM>", "<S_DTM>", "<S_FTX>", "<G_SG1>", "<G_SG2>", "<G_SG7>", "<G_SG8>", "<G_SG26>", "<S_UNS>", "<G_SG50>", "<G_SG52>"];
for (let index = 1; index < topLevelOrder.length; index += 1) {
  assert(
    referenceXml.indexOf(topLevelOrder[index - 1]) < referenceXml.indexOf(topLevelOrder[index]),
    `${topLevelOrder[index - 1]} must precede ${topLevelOrder[index]}`
  );
}

const referenceXmlPath = join(tmpDir, "reference-pra26-2446.xml");
writeFileSync(referenceXmlPath, referenceXml);
if (existsSync(xsdPath)) run("xmllint", ["--noout", "--schema", xsdPath, referenceXmlPath]);

const invalidReference = structuredClone(referenceFixture);
delete invalidReference.lines[0].price;
assertPreparationError(invalidReference, "BT-146", "Reference invoice without BT-146 must not generate XML");

const missingPriceInvoice = structuredClone(standardFixture);
delete missingPriceInvoice.lines[0].price;
const missingPriceResult = prepareInvoiceForEslog(missingPriceInvoice);
assert(!missingPriceResult.validation.valid, "Invoice line without price must fail validation");
assert(
  missingPriceResult.validation.errors.some(
    (error) => error.includes("Postavka 1") && error.includes("BT-146") && error.includes("cena")
  ),
  "Missing item price must produce a clear BT-146 line validation error"
);
assert(
  missingPriceResult.validation.errors.some((error) => error.includes("Manjka neto cena artikla (BT-146)")),
  "Missing item price message must be user-friendly and include BT-146"
);
assert(missingPriceResult.xml === "", "Invalid invoice must not generate XML");

function assertPreparationError(invoice, code, message) {
  const result = prepareInvoiceForEslog(invoice);
  assert(!result.validation.valid, message);
  assert(
    result.validation.errors.some((error) => error.includes(code)),
    `${message}: expected ${code} validation error`
  );
  assert(result.xml === "", `${message}: invalid invoice must not generate XML`);
}

const canonicalPaymentInvoice = structuredClone(standardFixture);
canonicalPaymentInvoice.payment.iban = "si56 1910 0000 0123 438";
canonicalPaymentInvoice.seller.vat = " 1234 5678 ";
canonicalPaymentInvoice.seller.taxId = "1234 5678";
canonicalPaymentInvoice.buyer.vat = " 8765 4321 ";
canonicalPaymentInvoice.buyer.taxId = "8765 4321";
const canonicalPaymentResult = prepareInvoiceForEslog(canonicalPaymentInvoice);
assert(canonicalPaymentResult.validation.valid, "Canonical spacing and case must remain valid");
assertIncludes(
  canonicalPaymentResult.xml,
  "<D_3194>SI56191000000123438</D_3194>",
  "IBAN must be safely canonicalized before XML output"
);
assertIncludes(
  canonicalPaymentResult.xml,
  "<D_1154>SI12345678</D_1154>",
  "VAT ID must be safely canonicalized before XML output"
);

const missingPaymentMeans = structuredClone(standardFixture);
delete missingPaymentMeans.payment.paymentMeansCode;
delete missingPaymentMeans.eSlog.paymentMeansCode;
assertPreparationError(missingPaymentMeans, "BT-81", "Missing payment means code must fail");

const malformedPaymentMeans = structuredClone(standardFixture);
malformedPaymentMeans.payment.paymentMeansCode = "SEPA";
assertPreparationError(malformedPaymentMeans, "BT-81", "Malformed payment means code must fail");

const missingIban = structuredClone(standardFixture);
delete missingIban.payment.iban;
assertPreparationError(missingIban, "BT-84", "Missing seller IBAN must fail");
assert(
  prepareInvoiceForEslog(missingIban).validation.errors.some(
    (error) => error.includes("Manjka IBAN prejemnika plačila (BT-84)")
  ),
  "Missing IBAN message must name the payment recipient and BT-84"
);

const malformedIban = structuredClone(standardFixture);
malformedIban.payment.iban = "SI00123456789012345";
assertPreparationError(malformedIban, "BT-84", "IBAN with invalid checksum must fail");

const missingPaymentReference = structuredClone(standardFixture);
delete missingPaymentReference.payment.reference;
assertPreparationError(missingPaymentReference, "BT-89", "Missing payment reference must fail");

const malformedPaymentReference = structuredClone(standardFixture);
malformedPaymentReference.payment.reference = "R".repeat(141);
assertPreparationError(malformedPaymentReference, "BT-89", "Oversized payment reference must fail");

const malformedSellerVat = structuredClone(standardFixture);
malformedSellerVat.seller.vat = "SI-123";
malformedSellerVat.seller.taxId = "SI-123";
assertPreparationError(malformedSellerVat, "Izdajatelj", "Malformed seller VAT/tax ID must fail");

const malformedBuyerVat = structuredClone(standardFixture);
malformedBuyerVat.buyer.vat = "SI-987";
malformedBuyerVat.buyer.taxId = "SI-987";
assertPreparationError(malformedBuyerVat, "Kupec", "Malformed buyer VAT/tax ID must fail");

const zeroVatInvoice = structuredClone(standardFixture);
zeroVatInvoice.lines = [
  {
    ...zeroVatInvoice.lines[0],
    quantity: 2,
    price: 80,
    vatCategory: "E",
    vatRate: 0,
    taxExemptionReason: "Oproščeno plačila DDV po veljavnem predpisu",
  },
];
zeroVatInvoice.totals.payable = 160;
const zeroVatResult = prepareInvoiceForEslog(zeroVatInvoice);
assert(zeroVatResult.validation.valid, "Zero VAT invoice with exemption reason must be valid");
assertMatches(
  zeroVatResult.xml,
  /<G_SG52>[\s\S]*?<D_5278>0\.00<\/D_5278>[\s\S]*?<D_5305>E<\/D_5305>[\s\S]*?<D_5025>125<\/D_5025>[\s\S]*?<D_5004>160\.00<\/D_5004>[\s\S]*?<D_5025>124<\/D_5025>[\s\S]*?<D_5004>0\.00<\/D_5004>[\s\S]*?<\/G_SG52>/,
  "Zero VAT breakdown must contain category E, rate 0, taxable amount, and zero tax"
);

const multipleVatInvoice = structuredClone(standardFixture);
multipleVatInvoice.lines = [
  {
    ...multipleVatInvoice.lines[0],
    id: 1,
    description: "Storitev po splošni stopnji",
    quantity: 2,
    price: 50,
    vatCategory: "S",
    vatRate: 22,
  },
  {
    ...multipleVatInvoice.lines[0],
    id: 2,
    description: "Storitev po nižji stopnji",
    quantity: 1,
    price: 100,
    vatCategory: "S",
    vatRate: 9.5,
  },
];
multipleVatInvoice.totals.payable = 231.5;
const multipleVatResult = prepareInvoiceForEslog(multipleVatInvoice);
assert(multipleVatResult.validation.valid, "Invoice with multiple VAT rates must be valid");
const vatGroups = multipleVatResult.xml.match(/<G_SG52>[\s\S]*?<\/G_SG52>/g) || [];
assert(
  countOccurrences(multipleVatResult.xml, "<G_SG52>") === 2 && vatGroups.length === 2,
  "Each VAT category/rate combination must produce one VAT breakdown group"
);
const standardVatGroup = vatGroups.find((group) => group.includes("<D_5278>22.00</D_5278>")) || "";
const reducedVatGroup = vatGroups.find((group) => group.includes("<D_5278>9.50</D_5278>")) || "";
assertMatches(
  standardVatGroup,
  /<D_5278>22\.00<\/D_5278>[\s\S]*?<D_5305>S<\/D_5305>[\s\S]*?<D_5004>100\.00<\/D_5004>[\s\S]*?<D_5004>22\.00<\/D_5004>/,
  "22% VAT breakdown amounts must be correct"
);
assertMatches(
  reducedVatGroup,
  /<D_5278>9\.50<\/D_5278>[\s\S]*?<D_5305>S<\/D_5305>[\s\S]*?<D_5004>100\.00<\/D_5004>[\s\S]*?<D_5004>9\.50<\/D_5004>/,
  "9.5% VAT breakdown amounts must be correct"
);

const hrInvoice = structuredClone(standardFixture);
hrInvoice.profile = "hr";
hrInvoice.number = "222-PP01-01";
hrInvoice.issueTime = "14:25:09";
hrInvoice.businessProcess = "P1";
hrInvoice.seller = {
  ...hrInvoice.seller,
  vat: "HR12345678901",
  taxId: "HR12345678901",
  oib: "12345678901",
  country: "HR",
  eAddress: "prodavatelj@ams.hr",
};
hrInvoice.buyer = {
  ...hrInvoice.buyer,
  vat: "HR10987654321",
  taxId: "HR10987654321",
  oib: "10987654321",
  country: "HR",
  eAddress: "kupac@ams.hr",
};
hrInvoice.operator = { oib: "12345678901", code: "OP01" };
hrInvoice.hrData = {
  issueTime: "14:25:09",
  businessProcessType: "P1",
  operatorOib: "12345678901",
  operatorCode: "OP01",
  previousInvoiceNumber: "111-PP01-01",
  previousInvoiceDate: "2026-05-31",
};
hrInvoice.lines[0].kpdCode = "62.01.11";
hrInvoice.lines[0].kpdListId = "CG";
hrInvoice.lines[0].hrVatCategoryCode = "HR:S";

for (const [mutate, expectedCode, message] of [
  [(invoice) => { delete invoice.issueTime; delete invoice.hrData.issueTime; }, "HR-BT-2", "HR invoice without issue time must fail"],
  [(invoice) => { delete invoice.operator.oib; delete invoice.hrData.operatorOib; }, "HR-BT-5", "HR invoice without operator OIB must fail"],
  [(invoice) => { delete invoice.operator.code; delete invoice.hrData.operatorCode; }, "HR-BT-4", "HR invoice without operator code must fail"],
  [(invoice) => { delete invoice.lines[0].kpdCode; }, "BT-158", "HR invoice without KPD/CPA must fail"],
]) {
  const invalidInvoice = structuredClone(hrInvoice);
  mutate(invalidInvoice);
  assertPreparationError(invalidInvoice, expectedCode, message);
}

const hrResult = prepareInvoiceForEslog(hrInvoice);
assert(hrResult.validation.valid, `Complete HR invoice must be valid: ${hrResult.validation.errors.join("; ")}`);
assertIncludes(hrResult.xml, "14:25:09#Vrijeme izdavanja", "HR issue time must be emitted as GEN free text");
assertIncludes(hrResult.xml, "12345678901:OP01#Oznaka operatera", "HR operator must be emitted as GEN free text");
assertMatches(hrResult.xml, /<D_1153>OI<\/D_1153>[\s\S]*?<D_1154>111-PP01-01<\/D_1154>[\s\S]*?<D_2005>384<\/D_2005>/, "Previous HR invoice must use RFF OI and DTM 384");
assertIncludes(hrResult.xml, "<D_7140>62.01.11</D_7140>", "HR KPD/CPA classification must be emitted");

const hrXmlPath = join(tmpDir, "hr-profile-invoice.xml");
writeFileSync(hrXmlPath, hrResult.xml);
if (existsSync(xsdPath)) run("xmllint", ["--noout", "--schema", xsdPath, hrXmlPath]);

const ujpWithoutReference = structuredClone(standardFixture);
ujpWithoutReference.profile = "ujp";
ujpWithoutReference.payment.purposeCode = "OTHR";
delete ujpWithoutReference.payment.reference;
assertPreparationError(ujpWithoutReference, "BT-89", "UJP invoice without payment reference must fail clearly");

const bankWithoutIban = structuredClone(standardFixture);
bankWithoutIban.profile = "bank";
bankWithoutIban.payment.purposeCode = "OTHR";
bankWithoutIban.payment.paymentPurpose = "Plačilo računa";
bankWithoutIban.bankData = { paymentModel: "SI00" };
delete bankWithoutIban.payment.iban;
assertPreparationError(bankWithoutIban, "BT-84", "Bank profile without IBAN must fail");

const validUjpInvoice = structuredClone(standardFixture);
validUjpInvoice.profile = "ujp";
validUjpInvoice.payment.purposeCode = "OTHR";
const validUjpResult = prepareInvoiceForEslog(validUjpInvoice);
assert(validUjpResult.validation.valid, "Complete UJP invoice must be valid");

const validBankInvoice = structuredClone(standardFixture);
validBankInvoice.profile = "bank";
validBankInvoice.payment.purposeCode = "OTHR";
validBankInvoice.payment.paymentPurpose = "Plačilo računa";
validBankInvoice.bankData = { paymentModel: "SI00" };
const validBankResult = prepareInvoiceForEslog(validBankInvoice);
assert(validBankResult.validation.valid, "Complete bank invoice must be valid");

for (const [name, result] of [
  ["valid-ujp-profile", validUjpResult],
  ["valid-bank-profile", validBankResult],
]) {
  const xmlPath = join(tmpDir, `${name}.xml`);
  writeFileSync(xmlPath, result.xml);
  if (existsSync(xsdPath)) run("xmllint", ["--noout", "--schema", xsdPath, xmlPath]);
}

for (const xml of [preparedStandard.xml, hrResult.xml, validUjpResult.xml, validBankResult.xml]) {
  assert(!/<([A-Za-z0-9_]+)>\s*<\/\1>/.test(xml), "XML must not contain empty elements");
}

console.log("eSLOG XML tests passed.");
