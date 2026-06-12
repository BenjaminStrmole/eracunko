import type { Invoice, InvoiceLine, Party, VatBreakdown } from "../../types/invoice";
import { getInvoiceProfileImplementation } from "./profiles/registry";
import { normalizeInvoiceForEslog } from "./normalizeInvoice";

function isPresent(value: unknown) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

export function escapeXml(value: string | number | undefined | null) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function formatAmount(value: number | undefined | null) {
  return Number(value || 0).toFixed(2);
}

function formatQuantity(value: number | undefined | null) {
  const numberValue = Number(value || 0);
  return Number.isInteger(numberValue)
    ? String(numberValue)
    : numberValue.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function formatDate(value: string) {
  return String(value || "").replaceAll("-", "");
}

function tag(name: string, value: string | number | undefined | null) {
  if (!isPresent(value)) return "";
  return `<${name}>${escapeXml(value)}</${name}>`;
}

function segment(name: string, body: string) {
  const content = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

  if (!content) return "";

  return `<${name}>\n${content}\n</${name}>`;
}

function lineNetAmount(line: InvoiceLine) {
  if (typeof line.netAmount === "number") return line.netAmount;
  return Number(line.quantity || 0) * Number(line.price || 0);
}

function lineVatAmount(line: InvoiceLine) {
  if (typeof line.vatAmount === "number") return line.vatAmount;
  return line.vatCategory === "S" ? lineNetAmount(line) * (Number(line.vatRate || 0) / 100) : 0;
}

function buildFreeText(subject: string, value?: string) {
  if (!isPresent(value)) return "";

  return segment(
    "S_FTX",
    `
      ${tag("D_4451", subject)}
      ${segment("C_C108", tag("D_4440", value))}
    `
  );
}

export function buildPartySegment(role: "SE" | "BY", party: Party) {
  const streetOrAddress = party.street || party.address;
  const taxId = party.vat || party.taxId || party.oib;

  const nad = segment(
    "S_NAD",
    `
      ${tag("D_3035", role)}
      ${segment("C_C082", `${tag("D_3039", party.endpointId || taxId)}${tag("D_3055", party.endpointSchemeId)}`)}
      ${segment("C_C080", tag("D_3036", party.name))}
      ${segment("C_C059", tag("D_3042", streetOrAddress))}
      ${tag("D_3164", party.city)}
      ${tag("D_3251", party.postCode)}
      ${tag("D_3207", party.country)}
    `
  );

  const references = [
    segment("S_RFF", segment("C_C506", `${tag("D_1153", "VA")}${tag("D_1154", party.vat || party.taxId)}`)),
    segment("S_RFF", segment("C_C506", `${tag("D_1153", "API")}${tag("D_1154", party.oib)}`)),
    segment("S_RFF", segment("C_C506", `${tag("D_1153", "XA")}${tag("D_1154", party.eLocation)}`)),
    segment("S_RFF", segment("C_C506", `${tag("D_1153", "EM")}${tag("D_1154", party.eAddress)}`)),
  ]
    .filter(Boolean)
    .join("\n");

  const contact = segment(
    "S_CTA",
    `
      ${tag("D_3139", "IC")}
      ${segment("C_C056", tag("D_3412", party.contactName))}
    `
  );

  const email = segment("S_COM", segment("C_C076", `${tag("D_3148", party.contactEmail)}${tag("D_3155", "EM")}`));

  return segment("G_SG2", `${nad}${references}${contact}${email}`);
}

export function buildLineSegment(line: InvoiceLine, index: number) {
  const netAmount = lineNetAmount(line);
  const vatAmount = lineVatAmount(line);
  const vatCategory = line.vatCategory || (Number(line.vatRate || 0) > 0 ? "S" : "Z");
  const unitCode = String(line.unit || "H87").toUpperCase();

  const taxExemption = buildFreeText(
    "TXD",
    line.taxExemptionReasonCode || line.taxExemptionReason
  );

  const classification = line.kpdCode
    ? segment(
        "S_PIA",
        `
          ${tag("D_4347", "5")}
          ${segment(
            "C_C212",
            `${tag("D_7140", line.kpdCode)}${tag("D_7143", line.kpdListId || "CG")}`
          )}
        `
      )
    : "";

  return segment(
    "G_SG26",
    `
      ${segment("S_LIN", tag("D_1082", line.id || index + 1))}
      ${classification}
      ${segment(
        "S_IMD",
        `
          ${segment(
            "C_C273",
            `${tag("D_7008", line.description)}${tag("D_7009", line.itemCode)}${tag("D_7008", line.itemDescription || line.note)}`
          )}
        `
      )}
      ${segment(
        "S_QTY",
        segment(
          "C_C186",
          `${tag("D_6063", "47")}${tag("D_6060", formatQuantity(line.quantity))}${tag("D_6411", unitCode)}`
        )
      )}
      ${segment(
        "S_MOA",
        segment("C_C516", `${tag("D_5025", "203")}${tag("D_5004", formatAmount(netAmount))}`)
      )}
      ${segment(
        "S_PRI",
        segment("C_C509", `${tag("D_5125", "AAA")}${tag("D_5118", formatAmount(line.price))}`)
      )}
      ${segment(
        "S_TAX",
        `
          ${tag("D_5283", "7")}
          ${segment("C_C241", `${tag("D_5153", "VAT")}${tag("D_5152", line.hrVatCategoryCode)}`)}
          ${segment("C_C243", tag("D_5278", formatAmount(line.vatRate)))}
          ${tag("D_5305", vatCategory)}
        `
      )}
      ${segment(
        "S_MOA",
        segment("C_C516", `${tag("D_5025", "124")}${tag("D_5004", formatAmount(vatAmount))}`)
      )}
      ${taxExemption}
    `
  );
}

export function buildTaxSegments(vatBreakdown: VatBreakdown[]) {
  return vatBreakdown
    .map((breakdown) =>
      segment(
        "G_SG50",
        `
          ${segment(
            "S_TAX",
            `
              ${tag("D_5283", "7")}
              ${segment("C_C241", tag("D_5153", "VAT"))}
              ${segment("C_C243", tag("D_5278", formatAmount(breakdown.vatRate)))}
              ${tag("D_5305", breakdown.vatCategory)}
            `
          )}
          ${segment(
            "S_MOA",
            segment(
              "C_C516",
              `${tag("D_5025", "125")}${tag("D_5004", formatAmount(breakdown.taxableAmount))}`
            )
          )}
          ${segment(
            "S_MOA",
            segment(
              "C_C516",
              `${tag("D_5025", "124")}${tag("D_5004", formatAmount(breakdown.vatAmount))}`
            )
          )}
          ${buildFreeText("TXD", breakdown.taxExemptionReason)}
        `
      )
    )
    .filter(Boolean)
    .join("\n");
}

export function buildBaseEslogInvoice(input: Invoice) {
  const invoice = normalizeInvoiceForEslog(input);
  const payment = invoice.payment || {};
  const references = invoice.references || {};
  const specificationIdentifier =
    invoice.eSlog?.specificationIdentifier || "urn:cen.eu:en16931:2017";
  const businessProcess =
    invoice.businessProcess || invoice.eSlog?.businessProcess || invoice.eSlog?.profileId || "P1";
  const paymentMeansCode =
    payment.paymentMeansCode || invoice.paymentMeansCode || invoice.eSlog?.paymentMeansCode || "58";
  const iban = payment.iban || payment.bankAccount || invoice.bankAccount;
  const bic = payment.bic || payment.bankBic || invoice.bankBic;
  const reference = payment.reference || invoice.reference;

  const linesXml = invoice.lines.map(buildLineSegment).join("\n");
  const taxXml = buildTaxSegments(invoice.vatBreakdown || []);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:eslog:2.00" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <M_INVOIC Id="data">
    ${segment(
      "S_UNH",
      `
        ${tag("D_0062", invoice.number)}
        ${segment(
          "C_S009",
          `${tag("D_0065", "INVOIC")}${tag("D_0052", "D")}${tag("D_0054", "01B")}${tag("D_0051", "UN")}`
        )}
      `
    )}

    ${segment(
      "S_BGM",
      `
        ${segment("C_C002", tag("D_1001", invoice.documentType || invoice.eSlog?.documentType || "380"))}
        ${segment("C_C106", tag("D_1004", invoice.number))}
        ${tag("D_1225", invoice.isCopy ? "31" : undefined)}
      `
    )}

    ${segment(
      "S_FTX",
      `
        ${tag("D_4451", "DOC")}
        ${segment("C_C107", tag("D_4441", businessProcess))}
        ${segment("C_C108", tag("D_4440", specificationIdentifier))}
      `
    )}
    ${businessProcess.startsWith("P99") ? buildFreeText("GEN", businessProcess) : ""}
    ${buildFreeText("GEN", invoice.issueTime ? `${invoice.issueTime}#Vrijeme izdavanja` : undefined)}
    ${buildFreeText(
      "GEN",
      invoice.operator?.oib && (invoice.operator.code || invoice.operator.name)
        ? `${invoice.operator.oib}:${invoice.operator.code || invoice.operator.name}#Oznaka operatera`
        : undefined
    )}
    ${buildFreeText("AAI", invoice.note)}
    ${buildFreeText("PMT", payment.paymentTerms)}

    ${segment(
      "S_DTM",
      segment("C_C507", `${tag("D_2005", "137")}${tag("D_2380", formatDate(invoice.issueDate))}${tag("D_2379", "102")}`)
    )}
    ${segment(
      "S_DTM",
      segment("C_C507", `${tag("D_2005", "35")}${tag("D_2380", formatDate(invoice.serviceDate))}${tag("D_2379", "102")}`)
    )}
    ${segment(
      "S_DTM",
      segment("C_C507", `${tag("D_2005", "13")}${tag("D_2380", formatDate(invoice.dueDate))}${tag("D_2379", "102")}`)
    )}
    ${invoice.cashAccounting ? segment("S_DTM", segment("C_C507", `${tag("D_2005", "432")}${tag("D_2380", formatDate(invoice.issueDate))}${tag("D_2379", "102")}`)) : ""}

    ${invoice.seller ? buildPartySegment("SE", invoice.seller) : ""}
    ${buildPartySegment("BY", invoice.buyer)}

    ${segment(
      "G_SG1",
      `
        ${segment("S_RFF", segment("C_C506", `${tag("D_1153", "ON")}${tag("D_1154", references.orderReference)}`))}
        ${segment("S_RFF", segment("C_C506", `${tag("D_1153", "CT")}${tag("D_1154", references.contractReference)}`))}
        ${segment("S_RFF", segment("C_C506", `${tag("D_1153", "DQ")}${tag("D_1154", references.deliveryNoteReference)}`))}
        ${segment("S_RFF", segment("C_C506", `${tag("D_1153", "CR")}${tag("D_1154", references.buyerReference)}`))}
        ${segment("S_RFF", segment("C_C506", `${tag("D_1153", "AEP")}${tag("D_1154", reference)}`))}
      `
    )}

    ${segment(
      "G_SG7",
      segment("S_CUX", segment("C_C504", `${tag("D_6347", "2")}${tag("D_6345", invoice.currency)}${tag("D_6343", "4")}`))
    )}

    ${segment(
      "G_SG8",
      `
        ${segment("S_PAT", tag("D_4279", "3"))}
        ${segment("S_PAI", segment("C_C534", tag("D_4461", paymentMeansCode)))}
      `
    )}

    ${segment(
      "G_SG12",
      `
        ${segment("S_FII", `${tag("D_3035", "RB")}${segment("C_C078", tag("D_3194", iban))}${segment("C_C088", tag("D_3433", bic))}`)}
        ${segment("S_MOA", segment("C_C516", `${tag("D_5025", "9")}${tag("D_5004", formatAmount(invoice.totals.payable || invoice.totals.gross))}`))}
      `
    )}

    ${linesXml}

    ${segment("S_UNS", tag("D_0081", "S"))}

    ${taxXml}

    ${segment("S_MOA", segment("C_C516", `${tag("D_5025", "79")}${tag("D_5004", formatAmount(invoice.totals.net))}`))}
    ${segment("S_MOA", segment("C_C516", `${tag("D_5025", "176")}${tag("D_5004", formatAmount(invoice.totals.vat))}`))}
    ${segment("S_MOA", segment("C_C516", `${tag("D_5025", "77")}${tag("D_5004", formatAmount(invoice.totals.gross))}`))}
    ${segment("S_MOA", segment("C_C516", `${tag("D_5025", "9")}${tag("D_5004", formatAmount(invoice.totals.payable || invoice.totals.gross))}`))}
  </M_INVOIC>
</Invoice>`;
}

export function buildEslogInvoiceXml(input: Invoice) {
  const invoice = normalizeInvoiceForEslog(input);
  const baseXml = buildBaseEslogInvoice(invoice);
  const profileImplementation = getInvoiceProfileImplementation(invoice.profile);

  return profileImplementation.applyXml(baseXml, invoice);
}
