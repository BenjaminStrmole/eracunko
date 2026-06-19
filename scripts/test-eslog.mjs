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

  if (existsSync(xsdPath)) {
    run("xmllint", ["--noout", "--schema", xsdPath, xmlPath]);
  }
}

const standardFixture = JSON.parse(
  readFileSync(join(projectRoot, "fixtures/eslog/minimal-standard-invoice.json"), "utf8")
);
const preparedStandard = prepareInvoiceForEslog(standardFixture);
assert(preparedStandard.validation.valid, "Valid standard SI invoice must pass validation");
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
assert(missingPriceResult.xml === "", "Invalid invoice must not generate XML");

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

console.log("eSLOG XML tests passed.");
