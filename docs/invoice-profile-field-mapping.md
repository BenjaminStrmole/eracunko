# Invoice Profile Field Mapping

Source basis:
- bizBox support collection: Pošiljanje e-računa
- bizBox support article: Pošiljanje preko ERP (računovodski program)
- bizBox support article: Pošiljanje proračunskim uporabnikom (UJP)
- bizBox support article: Pošiljanje na Hrvaško (HR)
- bizBox support article: Pošiljanje na banko
- bizBox support article: Vnos kupca
- bizBox support article: Vnos prodajalca
- bizBox support article: Podatki o računu

Important constraint: this document maps fields supported by the documentation and compares them with the current eRačunko code. It does not change XML generation. BT mappings are listed only where they are already known from EN16931/eSLOG usage in the current code or are directly implied by the field meaning; the bizBox support articles are mostly UI/process documentation and do not publish a full BT table.

## Common Standard Slovenian eSLOG Invoice

### Required fields

| Field | eSLOG / BT mapping | UI section | Validation rule | XML generator impact | Current status |
| --- | --- | --- | --- | --- | --- |
| Seller/company identity | Seller party, supplier party; BT-27/BT-31-like party data | Active company / seller | Active company must exist and include name, VAT/tax ID, address, country, eLocation/eAddress when sending through bizBox | Used as seller party and envelope sender | Mostly supported via activeCompany and seller normalization |
| Buyer identity | Buyer party; BT-44/BT-48-like party data | Buyer | Buyer name, tax/VAT ID, address, country, eLocation required for delivery | Used as buyer party and endpoint | Supported |
| Invoice number | Document ID; BT-1 | Invoice data | Required, unique enough for sender workflow | XML invoice ID | Supported |
| Issue date | BT-2 | Invoice data | Required date | XML issue date | Supported |
| Service/delivery date | BT-72 or delivery/service period equivalent | Invoice data | Required by current app; bizBox docs mention delivery/service date | XML delivery/service info | Supported |
| Due date | BT-9 | Invoice data / payment | Required when payable amount is greater than zero | XML payment terms/due date | Supported |
| Currency | BT-5 | Invoice data | EUR in current app | XML currency | Supported |
| Document type | BT-3 | Invoice data | Must be one of supported invoice document types | XML document type code | Supported |
| Business process | BT-23/profile/process equivalent | Invoice data | Required/expected when references are used; P1 common | XML business process/profile metadata | Supported |
| Payment means | BT-81 | Payment | Required for payment instruction | XML payment means | Supported |
| Payment reference/sklic | BT-89 | Payment | Required for send-ready invoice; sklic should start with SI or RF, max 12 characters per bizBox article, no spaces, no invalid hyphen position | XML payment reference | Supported, validation partly supported; reference format needs tightening |
| Purpose code/koda namena | Payment/purpose extension; current eSlog data purposeCode | Payment | Required where payment details are required | XML payment/purpose data if profile layer emits it | Supported in model/UI |
| Payment purpose/namen plačila | Payment terms/remittance description | Payment | Documented by bizBox for UJP/bank; useful for standard too | May affect payment terms/remittance text | Partly supported as `payment.paymentTerms`, not a distinct purpose text |
| Line description | BT-154-like item name/description | Lines | Required per line | XML invoice line item | Supported |
| Quantity | BT-129 | Lines | > 0 | XML invoice line quantity | Supported |
| Unit | BT-130 | Lines | Required | XML unit code | Supported |
| Net price | BT-146 | Lines | Valid number | XML line price | Supported |
| VAT category | BT-151 | Lines | Required and valid category | XML tax category | Supported |
| VAT rate | BT-152 | Lines | Required numeric; zero for zero/exempt/reverse charge categories | XML tax percent | Supported |
| VAT exemption reason | BT-120/BT-121-like tax exemption text/code | Lines / VAT | Required/recommended for exempt, zero, reverse charge categories | XML tax exemption reason | Supported |

### Optional fields

| Field | eSLOG / BT mapping | UI section | Validation rule | XML generator impact | Current status |
| --- | --- | --- | --- | --- | --- |
| Note | BT-22 | Invoice data | Optional | XML note | Supported |
| Order reference | BT-13 | References | Optional for standard; required when process/reference context demands it | XML order reference | Supported |
| Contract reference | BT-12 | References | Optional for standard | XML contract reference | Supported |
| Delivery note reference | Despatch/delivery reference | References | Optional for standard | XML delivery note reference | Supported |
| Buyer reference | BT-10 | References | Optional for standard | XML buyer reference | Supported |
| Seller registration number | Seller legal/company registration | Active company/settings | Optional for standard; required for UJP/bank according to bizBox process docs | May need party legal registration extension | Type supports `registrationNumber`; settings/activeCompany flow likely incomplete |
| Seller IBAN/BIC | Payment account | Settings/payment | Optional until payment profile needs it | XML payment account | Supported via settings/payment |
| Buyer IBAN/BIC | Buyer/partner master data | Buyer/customer | Optional for standard; recommended/required in some network scenarios | Usually not invoice XML unless needed by network/profile | Missing in buyer/customer UI |

## UJP Invoice Profile

bizBox documents UJP as a special sending path for public budget users. It says that, compared with an ordinary bizBox invoice, UJP requires the seller/company registration number and additional payment/process/reference data.

### Required fields

| Field | eSLOG / BT mapping | UI section | Validation rule | XML generator impact | Current status |
| --- | --- | --- | --- | --- | --- |
| Seller registration number / Matična številka | Supplier legal registration equivalent | Active company/settings | Required for UJP sending according to bizBox docs | Must be present in seller/legal party data if XML/profile supports it | Type supports `seller.registrationNumber`; active company/settings mapping incomplete |
| Buyer/public budget user identity | Buyer party plus UJP recipient/budget user context | Buyer / UJP profile | Buyer must be selected/complete; UJP recipient/budget user should be captured when known | Buyer party and possible profile extension | `ujpData.budgetUser`, `ujpData.ujpRecipient` exist |
| Payment reference/sklic | BT-89 | Payment | Required; no spaces/special chars per UJP doc; also apply standard sklic constraints from invoice data article | XML payment reference | Supported but validation should be stricter |
| Purpose code/koda namena | Payment purpose code | Payment | Required | XML payment/purpose data | Supported |
| Payment purpose/namen plačila | Remittance/payment text | Payment | Required by bizBox UJP article | Needs clear target field; likely payment terms/remittance text | Missing as distinct field |
| Business process | BT-23/profile/process equivalent | Invoice data | Required | XML profile/process data | Supported |
| At least one reference: contract/order/delivery note | BT-12/BT-13/despatch reference | References | Required: one of contract reference, order reference, delivery note reference | XML reference segment | Supported, but current UJP validator warns about missing order, contract, and buyer reference separately; should change to "at least one of three" |
| Required line item fields | BT-126+ line data | Lines | All required article fields marked by UI/profile should be present | XML invoice lines | Supported by common line validation |

### Optional fields

| Field | eSLOG / BT mapping | UI section | Validation rule | XML generator impact | Current status |
| --- | --- | --- | --- | --- | --- |
| Public procurement reference | Public procurement/project reference | UJP profile / References | Optional unless buyer requires it | Profile extension/reference | Supported as `ujpData.publicProcurementReference` |
| Additional UJP reference | Profile-specific reference | UJP profile | Optional | Profile extension | Supported as `ujpData.additionalReference` |
| Buyer reference | BT-10 | References | Optional unless buyer requires it; bizBox UJP article specifically names contract/order/delivery note for "one of" references | XML buyer reference | Supported; current profile config lists as required but docs do not clearly require it |

## Croatian Invoice / HR Fiskalizacija 2.0 Profile

bizBox support documentation for HR describes sending Croatian e-invoices through bizBox/Fina-like recipient data. It is not a full HR Fiskalizacija 2.0 technical spec. Existing eRačunko HR profile already contains deeper HR Fiskalizacija fields that are not all confirmed by this bizBox article.

### Required fields clearly supported by bizBox docs

| Field | eSLOG / BT mapping | UI section | Validation rule | XML generator impact | Current status |
| --- | --- | --- | --- | --- | --- |
| Buyer VAT/tax ID with HR prefix when not VAT payer | Buyer tax/VAT ID | Buyer | If Croatian recipient is not VAT payer, still require HR country prefix in the tax field | Buyer party tax ID | Partly supported by buyer VAT field; needs HR-specific validation |
| Buyer VAT payer flag | Buyer tax status / VAT category context | Buyer / HR profile | Required to decide whether recipient is VAT payer | May affect party tax ID/VAT handling; likely no direct standard BT | Missing |
| Buyer OIB without country prefix for lookup | Buyer OIB / endpoint detail | Buyer / HR profile | OIB is 11 digits without HR prefix for Fina lookup | May map to buyer.oib / endpoint ID | Type supports `buyer.oib`; UI derives from VAT, but separate HR lookup OIB field missing |
| Buyer business/organization unit code | HR recipient organization unit / endpoint extension | Buyer / HR profile | Required when available from HR/Fina lookup; leave empty when recipient has no unit code | Profile extension / buyer endpoint detail | Missing |
| VAT text for non-standard VAT rates/categories | VAT exemption/reason text | Lines / VAT breakdown | Required when VAT rate/category is not S - standard | XML tax exemption reason / VAT breakdown text | Supported as `taxExemptionReason`; HR UI could emphasize requirement |
| Required line item fields | BT-126+ line data | Lines | All fields marked by profile/UI as required | XML line data | Supported by common validation |

### Fields present in current HR profile but not clearly documented by bizBox support article

| Field | eSLOG / BT mapping | UI section | Validation rule | XML generator impact | Current status |
| --- | --- | --- | --- | --- | --- |
| Issue time | HR-specific fiscalization / profile extension | HR profile | Current validator requires HH:MM:SS | HR XML extension | Supported, but source should be HR Fiskalizacija spec, not this bizBox article |
| Operator OIB / operator code | HR fiscalization | HR profile | Current validator requires OIB and operator code | HR XML extension | Supported, but not confirmed by bizBox support article |
| Business premise code / device code / three-part invoice number | HR fiscalization | Invoice/HR profile | Current validator enforces three-part invoice number | HR XML extension | Supported, but not confirmed by bizBox support article |
| KPD code and HR VAT category code | HR-CIUS/classification | Lines | Current validator requires both | HR XML extension / line classification | Supported, but not confirmed by bizBox support article |
| Previous invoice / self-billing / copy | HR profile extension | HR profile | Conditional | HR XML extension | Supported, but not confirmed by bizBox support article |

### Optional fields

| Field | eSLOG / BT mapping | UI section | Validation rule | XML generator impact | Current status |
| --- | --- | --- | --- | --- | --- |
| Buyer business unit code absent marker | N/A | HR profile | If Fina lookup returns only OIB and no unit, leave business unit empty | Avoid forcing extension value | Missing but can be represented by optional empty business unit field |

## Bank / Payment-Focused Invoice Profile

bizBox documents bank sending similarly to UJP: seller registration number is required and extra payment/process/reference data is required for bank network delivery.

### Required fields

| Field | eSLOG / BT mapping | UI section | Validation rule | XML generator impact | Current status |
| --- | --- | --- | --- | --- | --- |
| Seller registration number / Matična številka | Supplier legal registration equivalent | Active company/settings | Required for bank sending according to bizBox docs | Must be present in seller/legal party data if XML/profile supports it | Type supports `seller.registrationNumber`; active company/settings mapping incomplete |
| Buyer/partner registration number | Buyer legal registration equivalent | Buyer/customer | Recommended in buyer docs for bank/UJP; bank article says seller-side registration number in first step, buyer master data article recommends partner registration number | May be required by bank network; mapping unclear | Missing in buyer form/customer data |
| Buyer/partner IBAN | Buyer/partner payment master data | Buyer/customer | Recommended/required in partner master data for bank/UJP | Usually not seller payment instruction; unclear XML impact | Missing in buyer form/customer data |
| Buyer/partner BIC/SWIFT | Buyer/partner payment master data | Buyer/customer | Recommended/required in partner master data for bank/UJP | Unclear XML impact | Missing in buyer form/customer data |
| Payment reference/sklic | BT-89 | Payment | Required; no spaces/special chars per bank article; also apply standard sklic constraints | XML payment reference | Supported, validation should be stricter |
| Purpose code/koda namena | Payment purpose code | Payment | Required | XML payment/purpose data | Supported |
| Payment purpose/namen plačila | Remittance/payment text | Payment | Required by bank article | Needs distinct UI/model field | Missing as distinct field |
| Business process | BT-23/profile/process equivalent | Invoice data | Required | XML profile/process data | Supported |
| At least one reference: contract/order/delivery note | BT-12/BT-13/despatch reference | References | Required: one of contract reference, order reference, delivery note reference | XML reference segment | Supported |
| Payee IBAN | BT-84 | Payment | Required for bank/payment profile | XML payee account | Supported |
| Payee BIC | Financial institution ID | Payment | Required by current bank validator; bizBox partner/seller docs mention BIC/SWIFT | XML payment financial institution | Supported |
| Payment means | BT-81 | Payment | Required | XML payment means | Supported |

### Optional fields

| Field | eSLOG / BT mapping | UI section | Validation rule | XML generator impact | Current status |
| --- | --- | --- | --- | --- | --- |
| Payer name | Payment profile extension | Bank profile | Optional/recommended by current app | XML impact unclear | Supported as `bankData.payerName` |
| Payee name | Payment profile extension | Bank profile | Optional/recommended by current app | XML impact unclear | Supported as `bankData.payeeName` |
| Payment model | Sklic model / local payment extension | Bank profile/payment | Required by current profile field config; bizBox article names sklic but not a separate model field | XML impact unclear; avoid XML changes until confirmed | Supported as `bankData.paymentModel` |

## Current App Gap Summary

Clearly missing or incomplete fields supported by bizBox docs:

1. Active company/seller registration number flow: `Party.registrationNumber` exists, but settings/activeCompany/new invoice flow should ensure it is captured and sent for UJP/bank.
2. Buyer/customer registration number, IBAN and BIC/SWIFT: buyer docs recommend these for UJP/bank partner data, but the current buyer form/customer search flow does not capture them.
3. Distinct payment purpose/namen plačila: docs list this separately from purpose code; current app has `paymentTerms` and `note`, but no explicit payment purpose field.
4. UJP/bank reference validation: docs require one of contract/order/delivery note, not all of them. Current UJP config/validation is stricter or misaligned.
5. Sklic validation: docs give concrete constraints for SI/RF prefix, max length, no spaces, no invalid hyphen placement; current validation mainly checks presence.
6. HR buyer VAT payer flag: needed to handle non-VAT-payer Croatian recipients while still using HR prefix.
7. HR buyer business/organization unit code: required when Fina/Digitalne usluge lookup provides it; optional when no unit exists.
8. HR separate OIB lookup value: docs say lookup uses OIB without country prefix; current buyer VAT/OIB derivation may be insufficient for UI clarity.

## Recommended Implementation Order

1. UJP + bank shared payment/reference/company-registration improvements.
   - These are most clearly documented by bizBox support.
   - They mostly affect UI/model validation and existing XML fields, with less need for speculative XML extensions.
2. Standard profile validation tightening for sklic/payment purpose/reference behavior.
   - This improves all profiles without adding country-specific XML.
3. HR buyer fields from bizBox docs: VAT payer flag, OIB lookup value, business unit code, VAT text emphasis for non-standard VAT.
   - Do not expand HR fiscalization XML from bizBox support alone; use official HR Fiskalizacija 2.0/HR-CIUS specs for that layer.

## Risks and Unclear Points

- bizBox support articles are process/UI instructions, not a formal eSLOG or EN16931 mapping spec.
- BT mappings for registration number, HR organization unit, payment purpose text and bank-specific partner IBAN/BIC need confirmation against eSLOG 2.0 schema/profile documentation before XML changes.
- HR Fiskalizacija 2.0 requirements in the current code go beyond what the bizBox support article confirms. Keep existing HR plugin architecture, but validate new HR XML work against official Croatian specs.
- UJP and bank docs both mention "vsa rdeča polja" in screenshots, but the text only lists specific extra fields. This mapping treats textual fields as authoritative and flags screenshot-only fields as not implementable yet.
- Partner IBAN/BIC in buyer docs may be master-data requirements for bizBox portal workflows, not necessarily invoice XML fields. Avoid XML changes until the target eSLOG segment is confirmed.
