import type { Invoice, InvoiceLine, Party, VatBreakdown } from "../../types/invoice";
import { getInvoiceProfileImplementation } from "./profiles/registry";
import { normalizeInvoiceForEslog } from "./normalizeInvoice";
import { normalizeUnitCode } from "./unitCodes";

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
  return String(value || "");
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

function buildDateSegment(qualifier: string, value?: string) {
  if (!isPresent(value)) return "";

  return segment(
    "S_DTM",
    segment(
      "C_C507",
      `${tag("D_2005", qualifier)}${tag("D_2380", formatDate(value || ""))}`
    )
  );
}

function buildReferenceSegment(qualifier: string, value?: string) {
  if (!isPresent(value)) return "";

  return segment(
    "S_RFF",
    segment("C_C506", `${tag("D_1153", qualifier)}${tag("D_1154", value)}`)
  );
}

function buildReferenceGroup(qualifier: string, value?: string) {
  return segment("G_SG1", buildReferenceSegment(qualifier, value));
}

function buildDatedReferenceGroup(
  qualifier: string,
  value?: string,
  dateQualifier?: string,
  date?: string
) {
  if (!isPresent(value)) return "";
  return segment(
    "G_SG1",
    `${buildReferenceSegment(qualifier, value)}${buildDateSegment(dateQualifier || "171", date)}`
  );
}

function buildPartyReferenceGroup(qualifier: string, value?: string) {
  return segment("G_SG3", buildReferenceSegment(qualifier, value));
}

function buildMoaSegment(qualifier: string, amount: number | undefined | null) {
  return segment(
    "S_MOA",
    segment("C_C516", `${tag("D_5025", qualifier)}${tag("D_5004", formatAmount(amount))}`)
  );
}

function buildSummaryMoaGroup(qualifier: string, amount: number | undefined | null) {
  return segment("G_SG50", buildMoaSegment(qualifier, amount));
}

function buildFinancialInstitutionSegment(iban?: string, bic?: string) {
  if (!isPresent(iban) && !isPresent(bic)) return "";

  return segment(
    "S_FII",
    `
      ${tag("D_3035", "RB")}
      ${segment("C_C078", tag("D_3194", iban))}
      ${segment("C_C088", tag("D_3433", bic))}
    `
  );
}

export function buildPartySegment(
  role: "SE" | "BY",
  party: Party,
  options: { iban?: string; bic?: string } = {}
) {
  const streetOrAddress = party.street || party.address;
  const taxId = party.vat || party.taxId || party.oib;
  const endpointId = party.endpointId || party.eLocation || taxId;
  const electronicAddress = party.eAddress || party.contactEmail;

  const nad = segment(
    "S_NAD",
    `
      ${tag("D_3035", role)}
      ${segment("C_C082", tag("D_3039", endpointId))}
      ${segment("C_C080", tag("D_3036", party.name))}
      ${segment("C_C059", tag("D_3042", streetOrAddress))}
      ${tag("D_3164", party.city)}
      ${tag("D_3251", party.postCode)}
      ${tag("D_3207", party.country)}
    `
  );

  const references = [
    buildPartyReferenceGroup("0199", party.registrationNumber),
    buildPartyReferenceGroup("AHP", party.taxId),
    buildPartyReferenceGroup("VA", party.vat),
    buildPartyReferenceGroup("API", party.country === "HR" ? party.oib : undefined),
  ]
    .filter(Boolean)
    .join("\n");

  const contact =
    isPresent(electronicAddress) || isPresent(party.contactName)
      ? segment(
          "G_SG5",
          `
            ${segment(
              "S_CTA",
              `
                ${tag("D_3139", "IC")}
                ${segment("C_C056", tag("D_3412", party.contactName))}
              `
            )}
            ${segment("S_COM", segment("C_C076", `${tag("D_3148", electronicAddress)}${tag("D_3155", "EM")}`))}
          `
        )
      : "";

  const financialInstitution = role === "SE" ? buildFinancialInstitutionSegment(options.iban, options.bic) : "";

  return segment("G_SG2", `${nad}${financialInstitution}${references}${contact}`);
}

export function buildLineSegment(line: InvoiceLine, index: number) {
  const netAmount = lineNetAmount(line);
  const vatAmount = lineVatAmount(line);
  const vatCategory = line.vatCategory || (Number(line.vatRate || 0) > 0 ? "S" : "Z");
  const unitCode = normalizeUnitCode(line.unit);

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

  const sellerItemIdentifier = line.itemCode
    ? segment(
        "S_PIA",
        `
          ${tag("D_4347", "5")}
          ${segment("C_C212", `${tag("D_7140", line.itemCode)}${tag("D_7143", "SA")}`)}
        `
      )
    : "";

  return segment(
    "G_SG26",
    `
      ${segment(
        "S_LIN",
        `
          ${tag("D_1082", index + 1)}
        `
      )}
      ${sellerItemIdentifier}
      ${classification}
      ${segment(
        "S_IMD",
        `
          ${tag("D_7077", "F")}
          ${segment(
            "C_C273",
            `${tag("D_7008", line.description)}${tag("D_7008_2", line.itemDescription || line.note)}`
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
      ${segment("G_SG27", buildMoaSegment("203", netAmount))}
      ${segment(
        "G_SG29",
        segment(
          "S_PRI",
          segment(
            "C_C509",
            `${tag("D_5125", "AAA")}${tag("D_5118", formatAmount(line.price))}${tag("D_5284", "1")}${tag("D_6411", unitCode)}`
          )
        )
      )}
      ${segment(
        "G_SG34",
        `
          ${segment(
            "S_TAX",
            `
              ${tag("D_5283", "7")}
              ${segment("C_C241", `${tag("D_5153", "VAT")}${tag("D_5152", line.hrVatCategoryCode)}`)}
              ${segment("C_C243", tag("D_5278", formatAmount(line.vatRate)))}
              ${tag("D_5305", vatCategory)}
            `
          )}
          ${buildMoaSegment("125", netAmount)}
          ${buildMoaSegment("124", vatAmount)}
        `
      )}
      ${taxExemption}
    `
  );
}

export function buildTaxSegments(vatBreakdown: VatBreakdown[]) {
  return vatBreakdown
    .map((breakdown) =>
      segment(
        "G_SG52",
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
  const hrData = invoice.hrData || {};

  const linesXml = invoice.lines.map(buildLineSegment).join("\n");
  const taxXml = buildTaxSegments(invoice.vatBreakdown || []);
  const documentLevelTaxExemptions = (invoice.vatBreakdown || [])
    .map((breakdown) => breakdown.taxExemptionReason)
    .filter((reason): reason is string => isPresent(reason))
    .filter((reason, index, list) => list.indexOf(reason) === index)
    .map((reason) => buildFreeText("AGM", reason))
    .join("\n");

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

    ${buildDateSegment("137", invoice.issueDate)}
    ${buildDateSegment("35", invoice.serviceDate)}
    ${invoice.cashAccounting ? buildDateSegment("432", invoice.issueDate) : ""}

    ${segment(
      "S_FTX",
      `
        ${tag("D_4451", "DOC")}
        ${segment("C_C107", tag("D_4441", businessProcess))}
        ${segment("C_C108", tag("D_4440", specificationIdentifier))}
      `
    )}
    ${buildFreeText("AAB", payment.paymentTerms)}
    ${buildFreeText("AAT", payment.paymentPurpose)}
    ${buildFreeText("ALQ", payment.purposeCode || invoice.purposeCode)}
    ${buildFreeText("PMD", payment.paymentPurpose)}
    ${buildFreeText("GEN", invoice.note)}
    ${businessProcess.startsWith("P99") ? buildFreeText("GEN", businessProcess) : ""}
    ${buildFreeText("GEN", invoice.issueTime ? `${invoice.issueTime}#Vrijeme izdavanja` : undefined)}
    ${buildFreeText(
      "GEN",
      invoice.operator?.oib && (invoice.operator.code || invoice.operator.name)
        ? `${invoice.operator.oib}:${invoice.operator.code || invoice.operator.name}#Oznaka operatera`
        : undefined
    )}
    ${buildFreeText(
      "GEN",
      hrData.previousInvoiceNumber
        ? `${hrData.previousInvoiceNumber}#Prethodni račun`
        : undefined
    )}
    ${documentLevelTaxExemptions}

    ${buildReferenceGroup("ON", references.orderReference)}
    ${buildReferenceGroup("CT", references.contractReference)}
    ${buildReferenceGroup("AAK", references.deliveryNoteReference)}
    ${buildReferenceGroup("CR", references.buyerReference)}
    ${buildReferenceGroup("PQ", reference)}
    ${buildDatedReferenceGroup(
      "OI",
      hrData.previousInvoiceNumber,
      "384",
      hrData.previousInvoiceDate
    )}

    ${invoice.seller ? buildPartySegment("SE", invoice.seller, { iban, bic }) : ""}
    ${buildPartySegment("BY", invoice.buyer)}

    ${segment(
      "G_SG7",
      segment("S_CUX", segment("C_C504", `${tag("D_6347", "2")}${tag("D_6345", invoice.currency)}${tag("D_6343", "4")}`))
    )}

    ${segment(
      "G_SG8",
      `
        ${segment("S_PAT", tag("D_4279", "1"))}
        ${buildDateSegment("13", invoice.dueDate)}
        ${segment("S_PAI", segment("C_C534", tag("D_4461", paymentMeansCode)))}
      `
    )}

    ${linesXml}

    ${segment("S_UNS", tag("D_0081", "S"))}

    ${buildSummaryMoaGroup("79", invoice.totals.net)}
    ${buildSummaryMoaGroup("389", invoice.totals.net)}
    ${buildSummaryMoaGroup("176", invoice.totals.vat)}
    ${buildSummaryMoaGroup("388", invoice.totals.gross)}
    ${buildSummaryMoaGroup("9", invoice.totals.payable ?? invoice.totals.gross)}

    ${taxXml}
  </M_INVOIC>
</Invoice>`;
}

export function buildEslogInvoiceXml(input: Invoice) {
  const invoice = normalizeInvoiceForEslog(input);
  const baseXml = buildBaseEslogInvoice(invoice);
  const profileImplementation = getInvoiceProfileImplementation(invoice.profile);

  return profileImplementation.applyXml(baseXml, invoice);
}
