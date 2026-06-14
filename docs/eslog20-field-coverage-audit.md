# eSLOG 2.0 Field Coverage Audit

Source files reviewed:

- `/Users/benjaminstrmole/Downloads/e-SLOG-2/eSLOG20_INVOIC_v200.xsd`
- `/Users/benjaminstrmole/Downloads/e-SLOG-2/sample_eSLOG20_INVOIC_v200.xml`
- `/Users/benjaminstrmole/Downloads/e-SLOG-2/sample_eSLOG20_INVOIC_v200_with_BT.xml`
- `/Users/benjaminstrmole/Downloads/e-SLOG-2/CEFACT_to_eSLOG2.0_v01.xlsx`
- `/Users/benjaminstrmole/Downloads/e-SLOG-2/UBL2.1_to_eSLOG2.0_v01.xlsx`
- `/Users/benjaminstrmole/Downloads/e-SLOG-2/map_eSLOG20_eSLOG16.xlsx`
- `/Users/benjaminstrmole/Downloads/e-SLOG-2/map_eSLOG16_eSLOG20.xlsx`
- `/Users/benjaminstrmole/Downloads/e-SLOG-2/e-SLOG 2.0-1 avgust 2020 SL.pdf`
- `/Users/benjaminstrmole/Downloads/e-SLOG-2/e-SLOG 2.0-2 avgust 2020 SL.pdf`
- `/Users/benjaminstrmole/Downloads/e-SLOG-2/e-SLOG 2.0-3 maj 2018 SL.pdf`

This audit uses the official eSLOG 2.0 namespace `urn:eslog:2.00` and the `Invoice/M_INVOIC` structure from the XSD and samples.

## Coverage Matrix

| Business term | UI field | Current model path | eSLOG 2.0 path | Requirement | Current status | Validation rule | XML mapping status | Risk / notes |
|---|---|---|---|---|---|---|---|---|
| UNH message header | Generated | `invoice.number` | `/Invoice/M_INVOIC/S_UNH/D_0062`, `/C_S009` | Required by syntax | Yes | Invoice number required | Partial | Message reference currently reuses invoice number. Acceptable for now, but should later become a unique technical message id. |
| BT-1 Invoice number | Številka računa | `invoice.number` | `/S_BGM/C_C106/D_1004` | Required | Yes | Required, non-empty | Yes | OK. |
| BT-3 Invoice type code | Vrsta dokumenta | `invoice.documentType`, `invoice.eSlog.documentType` | `/S_BGM/C_C002/D_1001` | Required | Yes | Required, default 380 | Yes | OK for invoice/credit-note once UI limits codes. |
| BT-2 Invoice issue date | Datum izdaje | `invoice.issueDate` | `/S_DTM/C_C507[D_2005='137']/D_2380` | Required | Yes | Required ISO date | Yes | XSD/sample use `xs:date` (`YYYY-MM-DD`) and do not accept `D_2379`; mapping workbook mentions format 102 from CII/UBL conversion context. |
| BT-72 Actual delivery date | Datum storitve/dobave | `invoice.serviceDate` | `/S_DTM/C_C507[D_2005='35']/D_2380` | Conditional / important | Yes | Required by app | Yes | XSD/sample use `YYYY-MM-DD`. |
| Payment due date | Rok plačila | `invoice.dueDate` | `/G_SG8/S_DTM/C_C507[D_2005='13']/D_2380` | Required when payable amount > 0 | Partial | Required when payable > 0 | Needs fix | Current XML emitted due date as top-level `S_DTM`; sample and mapping place it inside payment terms group `G_SG8`. XSD expects date value as `YYYY-MM-DD`. |
| BT-23 Business process type | Poslovni proces | `invoice.businessProcess`, `invoice.eSlog.businessProcess` | `/S_FTX[D_4451='DOC']/C_C107/D_4441` | Required by EN profile context | Yes | P1-P12 or P99 | Yes | OK. |
| BT-24 Specification identifier | Specifikacija | `invoice.eSlog.specificationIdentifier` | `/S_FTX[D_4451='DOC']/C_C108/D_4440` | Required | Yes | Default must exist | Yes | Default `urn:cen.eu:en16931:2017`; profile-specific value may be needed later. |
| BT-22 Invoice note | Opomba | `invoice.note` | `/S_FTX[D_4451='GEN']/C_C108/D_4440` | Optional | Partial | Max length implicit only | Needs fix | Current XML uses `AAI`; mapping says BT-22 uses `GEN`. |
| BT-20 Payment terms | Plačilni pogoji | `invoice.payment.paymentTerms` | `/S_FTX[D_4451='AAB']/C_C108/D_4440` | Optional / recommended | Partial | Optional | Needs fix | Current XML uses `PMT`; mapping says `AAB`. |
| BT-81 Payment means type code | Način plačila | `invoice.payment.paymentMeansCode`, `invoice.paymentMeansCode` | `/G_SG8/S_PAT[D_4279='1']/../S_PAI/C_C534/D_4461` | Required for credit transfer | Partial | Required | Needs fix | Current `S_PAT` uses `D_4279=3`; mapping uses `1` for BT-81. |
| Payment purpose code | Koda namena | `invoice.payment.purposeCode`, `invoice.purposeCode` | Not clearly mapped in core rows used | Optional / national banking | Partial | Warning only | Not mapped | Do not map until exact segment is confirmed. |
| Payment purpose text | Namen plačila | `invoice.payment.paymentPurpose` | Not clearly mapped in core rows used | Optional / banking | Partial | Optional | Not mapped | Stored only. Avoid guessing XML path. |
| BT-83 Remittance information | Sklic | `invoice.payment.reference`, `invoice.reference` | Structured: `/G_SG1/S_RFF/C_C506[D_1153='PQ']/D_1154`; unstructured: `/S_FTX[D_4451='PMD']/C_C108/D_4440` | Required by app for payment | Partial | Required | Needs fix | Current XML uses `AEP`, which is project reference. Use `PQ` for structured sklic. |
| BT-84 Payment account identifier | IBAN | `invoice.payment.iban`, `invoice.bankAccount` | `/G_SG2[S_NAD/D_3035='SE']/S_FII[D_3035='RB']/C_C078/D_3194` | Required for credit transfer | Partial | Required | Needs fix | Current XML emits `S_FII` under `G_SG12`; mapping puts it inside seller party `G_SG2`. |
| BT-86 Payment service provider identifier | BIC/SWIFT | `invoice.payment.bic`, `invoice.bankBic` | `/G_SG2[S_NAD/D_3035='SE']/S_FII[D_3035='RB']/C_C088/D_3433` | Conditional / recommended | Partial | Currently optional | Needs fix | Safe to map when present. |
| BT-13 Purchase order reference | Naročilnica | `invoice.references.orderReference` | `/G_SG1/S_RFF/C_C506[D_1153='ON']/D_1154` | Optional / UJP-bank conditional | Yes | Profile validation | Yes | OK. |
| BT-12 Contract reference | Pogodba | `invoice.references.contractReference` | `/G_SG1/S_RFF/C_C506[D_1153='CT']/D_1154` | Optional / UJP-bank conditional | Yes | Profile validation | Yes | OK. |
| BT-16 Despatch advice reference | Dobavnica | `invoice.references.deliveryNoteReference` | `/G_SG1/S_RFF/C_C506[D_1153='AAK']/D_1154` | Optional / UJP-bank conditional | Partial | Profile validation | Needs fix | Current XML uses `DQ`; CEFACT/eSLOG mapping uses `AAK`. |
| BT-10 Buyer reference | Referenca kupca | `invoice.references.buyerReference` | `/G_SG2[BY]/G_SG3/S_RFF/C_C506[D_1153='CR']/D_1154` or header mapping variant | Partial | Optional | Profile validation | Partial | Current XML emits header `G_SG1/CR`. Mapping also shows buyer-party `G_SG3`; keep current only if receiver accepts, otherwise move later. |
| BT-14 Sales order reference | Prodajno naročilo | Not modeled | `/G_SG1/S_RFF/C_C506[D_1153='VN']/D_1154` | Optional | No | None | No | TODO. Add only when UI needs it. |
| BT-25 Previous invoice number | Predhodni račun | HR has `hrData.previousInvoiceNumber`; common model missing | `/G_SG1/S_RFF/C_C506[D_1153='OI']/D_1154` | Conditional for credit/correction | Partial | HR only | Not mapped generically | TODO. Do not implement HR/correction XML blindly. |
| Seller party | Prodajalec / aktivno podjetje | `invoice.seller` | `/G_SG2[S_NAD/D_3035='SE']` | Required | Yes | Required name, VAT, address, country, e-location | Partial | NAD base OK; references/contact nesting needs fix to `G_SG3`/`G_SG5`. |
| BT-27 Seller name | Naziv prodajalca | `invoice.seller.name` | `/G_SG2[SE]/S_NAD/C_C080/D_3036` | Required | Yes | Required | Yes | OK. |
| BT-29 Seller identifier | Identifikator prodajalca | `invoice.seller.endpointId`, `invoice.seller.eLocation`, VAT fallback | `/G_SG2[SE]/S_NAD/C_C082/D_3039`, scheme `/D_1131` | Required / conditional | Partial | eLocation required | Partial | Current generator uses `D_3055` for scheme; mapping uses `D_1131`. |
| BT-30 Seller legal registration identifier | Matična št. prodajalca | `invoice.seller.registrationNumber` | `/G_SG2[SE]/G_SG3/S_RFF/C_C506[D_1153='GN' or '0199']/D_1154` | Optional | Partial | Optional | Needs care | CEFACT shows `GN`, eSLOG16 map shows `0199`. Use `GN` for core BT-30 unless receiver profile says otherwise. |
| BT-31 Seller VAT identifier | DDV prodajalca | `invoice.seller.vat` | `/G_SG2[SE]/G_SG3/S_RFF/C_C506[D_1153='VA']/D_1154` | Required if VAT registered | Yes | Required | Needs fix | Current RFF not nested in `G_SG3`. |
| BT-32 Seller tax registration identifier | Davčna prodajalca | `invoice.seller.taxId` | `/G_SG2[SE]/G_SG3/S_RFF/C_C506[D_1153='AHP']/D_1154` | Conditional | Partial | VAT/tax required | Needs fix | Map when separate from VAT. |
| BT-34 Seller electronic address | eNaslov prodajalca | `invoice.seller.eAddress`, `contactEmail` | `/G_SG2[SE]/G_SG5/S_CTA[D_3139='IC']/../S_COM/C_C076[D_3155='EM']/D_3148` | Required by app | Partial | Required | Needs fix | Current XML emits as `RFF/EM`, not official contact communication path. |
| Buyer party | Kupec | `invoice.buyer` | `/G_SG2[S_NAD/D_3035='BY']` | Required | Yes | Required name, VAT, address, country | Partial | Same nesting issues as seller. |
| BT-44 Buyer name | Naziv kupca | `invoice.buyer.name` | `/G_SG2[BY]/S_NAD/C_C080/D_3036` | Required | Yes | Required | Yes | OK. |
| BT-46 Buyer identifier | Identifikator kupca | `invoice.buyer.endpointId`, `eLocation`, VAT fallback | `/G_SG2[BY]/S_NAD/C_C082/D_3039` | Conditional | Partial | eLocation required | Partial | Same scheme issue as seller. |
| BT-47 Buyer legal registration identifier | Matična št. kupca | `invoice.buyer.registrationNumber` | `/G_SG2[BY]/G_SG3/S_RFF/C_C506[D_1153='GN' or '0199']/D_1154` | Optional | Partial | Optional | Needs care | Same `GN` vs `0199` profile risk. |
| BT-48 Buyer VAT identifier | DDV kupca | `invoice.buyer.vat` | `/G_SG2[BY]/G_SG3/S_RFF/C_C506[D_1153='VA']/D_1154` | Required by app | Yes | Required | Needs fix | Current RFF not nested. |
| BT-49 Buyer electronic address | eNaslov kupca | `invoice.buyer.eAddress`, `contactEmail` | `/G_SG2[BY]/G_SG5/S_CTA[D_3139='IC']/../S_COM/C_C076[D_3155='EM']/D_3148` | Recommended / sometimes required | Partial | Warning | Needs fix | Map when present. |
| Delivery party | Prejemnik/dostava | Not modeled | `/G_SG2[S_NAD/D_3035='DP']` | Optional | No | None | No | TODO. Not required for minimal standard invoice. |
| VAT identifiers | DDV podatki | `seller.vat`, `buyer.vat` | Party `G_SG3/S_RFF` with `VA` | Required/conditional | Partial | Required in app | Needs fix | Nesting fix only. |
| Currency | Valuta | `invoice.currency` | `/G_SG7/S_CUX/C_C504[D_6347='2']/D_6345`, `D_6343='4'` | Required | Yes | Must be EUR | Yes | OK; app only supports EUR. |
| BT-126 Line id | Št. vrstice | `line.id` | `/G_SG26/S_LIN/D_1082` | Required | Yes | At least one line | Yes | OK. |
| BT-153 Item name / description | Opis postavke | `line.description` | `/G_SG26/S_IMD[D_7077='F']/C_C273/D_7008` | Required | Partial | Required | Needs fix | Current `S_IMD` lacks `D_7077='F'`. |
| BT-129 Quantity | Količina | `line.quantity` | `/G_SG26/S_QTY[C_C186/D_6063='47']/C_C186/D_6060` | Required | Yes | > 0 | Yes | OK. |
| BT-130 Unit | Enota | `line.unit` | `/G_SG26/S_QTY/C_C186/D_6411` | Required | Yes | Required | Yes | OK. |
| BT-146 Item net price | Neto cena | `line.price` | `/G_SG26/G_SG29/S_PRI[C_C509/D_5125='AAA']/C_C509/D_5118` | Required | Partial | >= 0 | Needs fix | Current `S_PRI` is directly under `G_SG26`; mapping uses `G_SG29`. |
| BT-131 Line net amount | Neto znesek vrstice | `line.netAmount` calculated | `/G_SG26/G_SG27/S_MOA[C_C516/D_5025='203']/D_5004` | Required | Partial | Quantity * price | Needs fix | Current `S_MOA` is directly under `G_SG26`; mapping uses `G_SG27`. |
| BT-151 Line VAT category | DDV kategorija | `line.vatCategory` | `/G_SG26/G_SG34/S_TAX[D_5283='7']/D_5305` | Required | Partial | S/Z/E/AE etc. | Needs fix | Current `S_TAX` is directly under `G_SG26`; mapping uses `G_SG34`. |
| BT-152 Line VAT rate | DDV stopnja | `line.vatRate` | `/G_SG26/G_SG34/S_TAX/C_C243/D_5278` | Required | Partial | S > 0, zero categories = 0 | Needs fix | Same nesting issue. |
| BT-116 VAT taxable amount | Davčna osnova po kategoriji | `invoice.vatBreakdown[].taxableAmount` | `/G_SG52/S_MOA[C_C516/D_5025='125']/D_5004` | Required | Partial | Must equal line sums | Needs fix | Current XML uses `G_SG50`; mapping uses `G_SG52` for VAT breakdown. |
| BT-117 VAT amount | DDV po kategoriji | `invoice.vatBreakdown[].vatAmount` | `/G_SG52/S_MOA[C_C516/D_5025='124']/D_5004` | Required | Partial | Must equal calculated VAT | Needs fix | Same. |
| BT-118 VAT category code | Kategorija DDV | `invoice.vatBreakdown[].vatCategory` | `/G_SG52/S_TAX/D_5305` | Required | Partial | Required | Needs fix | Same. |
| BT-119 VAT rate | Stopnja DDV | `invoice.vatBreakdown[].vatRate` | `/G_SG52/S_TAX/C_C243/D_5278` | Required | Partial | Required | Needs fix | Same. |
| BT-120 VAT exemption reason | Razlog oprostitve | `line.taxExemptionReason`, `vatBreakdown.taxExemptionReason` | Document: `/S_FTX[D_4451='AGM']/C_C108/D_4440`; line currently not fully confirmed | Conditional for Z/E/AE | Partial | Required for zero/exempt/reverse charge | Partial | Existing line `TXD` may be accepted by some receivers, but core BT-120 mapping shows document-level `AGM`. Keep zero-category validation; map document-level reason when present. |
| BT-106 Sum line net amount | Neto skupaj vrstic | `invoice.totals.net` | `/G_SG50/S_MOA[C_C516/D_5025='79']/D_5004` | Required | Partial | Total checks | Needs fix | Current direct `S_MOA`; mapping uses `G_SG50`. |
| BT-109 Total without VAT | Znesek brez DDV | `invoice.totals.net` | `/G_SG50/S_MOA[C_C516/D_5025='389']/D_5004` | Required | No | Total checks | Needs fix | Add `389`; for no allowances/charges equals BT-106. |
| BT-110 Total VAT | DDV skupaj | `invoice.totals.vat` | `/G_SG50/S_MOA[C_C516/D_5025='176']/D_5004` | Required | Partial | Must equal VAT breakdown | Needs fix | Current direct `S_MOA`. |
| BT-112 Total with VAT | Bruto skupaj | `invoice.totals.gross` | `/G_SG50/S_MOA[C_C516/D_5025='388']/D_5004` | Required | Partial | Net + VAT = gross | Needs fix | Current uses qualifier `77`; official mapping uses `388`. |
| BT-115 Payable amount | Za plačilo | `invoice.totals.payable`, `gross` fallback | `/G_SG50/S_MOA[C_C516/D_5025='9']/D_5004` | Required | Partial | Due date if > 0 | Needs fix | Current direct `S_MOA`. |
| National extensions | UJP/banka/HR profili | `invoice.profile`, `hrData`, `ujpData`, `bankData` | Profile-specific extension layers | Conditional | Partial | Profile plugin validation | Partial | Keep plugin architecture. Do not hardcode profile rules in common generator. |
| HR Fiskalizacija 2.0 | HR profil | `hrData`, `operator` | Not safely confirmed from current core mappings | Conditional | Partial | Existing HR checks | Not changed | TODO. Do not implement HR XML until exact fiscalization 2.0 profile mapping is confirmed. |

## Minimal Safe Implementation Scope

The following changes are safe because they are directly supported by the official mapping rows and samples:

- Move payment due date into `G_SG8/S_DTM` with qualifier `13`.
- Map payment terms as `S_FTX/D_4451=AAB`.
- Map invoice note as `S_FTX/D_4451=GEN`.
- Keep BT-23/BT-24 in `S_FTX/D_4451=DOC`.
- Map payment reference/sklic as `G_SG1/S_RFF/D_1153=PQ`.
- Map IBAN/BIC in seller party `G_SG2[SE]/S_FII[D_3035=RB]`.
- Nest party references in `G_SG3` and electronic addresses in `G_SG5`.
- Use `AAK` for despatch/delivery note reference.
- Nest line net amount in `G_SG27`, price in `G_SG29`, line VAT in `G_SG34`.
- Emit VAT breakdown as `G_SG52`.
- Emit document totals as `G_SG50` with qualifiers `79`, `389`, `176`, `388`, and `9`.

## Intentionally Left Unmapped

- HR fiscalization 2.0 fields and HR-specific XML extensions.
- Payment purpose text and purpose code, until the exact eSLOG segment is confirmed for the chosen receiver profile.
- Delivery party (`DP`), tax representative, allowances/charges, sales order reference, receiving advice, preceding invoice details, and line accounting references.
- Profile-specific UJP/bank national extensions beyond existing safe reference/payment validation.

## Validation Notes

- Common validation should block missing core fields before XML generation: invoice number, issue date, service date, due date when payable, seller, buyer, lines, VAT breakdown, totals, IBAN, payment reference, payment means code.
- Profile validation remains separate through the invoice profile plugin registry.
- Zero/exempt/reverse-charge categories (`Z`, `E`, `AE`) must allow zero VAT amount but require an exemption reason or reason code.

## XSD Validation

If `xmllint` is available, validate a generated invoice with:

```bash
xmllint --noout \
  --schema /Users/benjaminstrmole/Downloads/e-SLOG-2/eSLOG20_INVOIC_v200.xsd \
  generated-eslog.xml
```

If using Python with `lxml`, load the same XSD and validate the generated XML document. The app should not require this dependency at runtime.
