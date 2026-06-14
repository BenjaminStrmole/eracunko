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
]);

const requireFromTmp = createRequire(join(tmpDir, "index.js"));
const { buildEslogInvoiceXml } = requireFromTmp(join(tmpDir, "lib/eslog/buildEslogInvoiceXml.js"));

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

console.log("eSLOG XML tests passed.");
