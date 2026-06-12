"use client";

import {
  ArrowRight,
  FileCode2,
  FilePlus2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { invoiceProfiles } from "../../../lib/eslog/invoiceProfiles";
import { prepareInvoiceForEslog } from "../../../lib/eslog/prepareInvoiceForEslog";
import type { ProfileFieldDefinition } from "../../../lib/eslog/profiles/types";
import type {
  Invoice,
  InvoiceLine,
  InvoiceProfile,
  VatCategory,
} from "../../../types/invoice";
import AppShell from "../../components/AppShell";

type Customer = {
  name: string;
  vatNumber: string;
  status: "READY" | "NOT_READY";
  eLocation: string;
  eAddress?: string;
  address?: string;
  postCode?: string;
  city?: string;
  country?: string;
  format: string;
  isFavorite?: boolean;
};

type ActiveCompany = {
  name?: string;
  vatNumber?: string;
  taxId?: string;
  eLocation?: string;
  eAddress?: string;
  address?: string;
  postCode?: string;
  city?: string;
  country?: string;
  locationId?: string;
};

type CompanySettings = {
  iban?: string;
  bic?: string;
  defaultDueDays?: string;
  invoicePrefix?: string;
};

type BuyerForm = {
  name: string;
  vat: string;
  address: string;
  postCode: string;
  city: string;
  country: string;
  eLocation: string;
  eAddress: string;
};

type EditableLine = InvoiceLine & {
  vatCategory: VatCategory;
};

type StoredInvoice = {
  number?: string;
};

type ProfileFieldValue = string | boolean;
type ProfileDataState = Record<InvoiceProfile, Record<string, ProfileFieldValue>>;

const VAT_CATEGORIES: Array<{ value: VatCategory; label: string }> = [
  { value: "S", label: "S - Standardna stopnja" },
  { value: "Z", label: "Z - Nicelna stopnja" },
  { value: "E", label: "E - Oprosceno" },
  { value: "AE", label: "AE - Reverse charge" },
  { value: "O", label: "O - Ni predmet DDV" },
  { value: "G", label: "G - Izvoz" },
  { value: "IC", label: "IC - Dobava znotraj EU" },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nowTime() {
  return new Date().toTimeString().slice(0, 8);
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeVat(value: string) {
  return value.replace(/\s/g, "").toUpperCase();
}

function taxCountry(value?: string) {
  const normalized = normalizeVat(value || "");
  if (/^[A-Z]{2}/.test(normalized)) return normalized.slice(0, 2);
  return "SI";
}

function nextInvoiceNumberPart() {
  const saved = safeJsonParse<StoredInvoice[]>(localStorage.getItem("invoices"), []);
  const drafts = safeJsonParse<StoredInvoice[]>(localStorage.getItem("drafts"), []);
  return String(saved.length + drafts.length + 1);
}

function emptyBuyer(): BuyerForm {
  return {
    name: "",
    vat: "",
    address: "",
    postCode: "",
    city: "",
    country: "SI",
    eLocation: "",
    eAddress: "",
  };
}

function customerToBuyer(customer: Customer): BuyerForm {
  return {
    name: customer.name || "",
    vat: customer.vatNumber || "",
    address: customer.address || "",
    postCode: customer.postCode || "",
    city: customer.city || "",
    country: customer.country || taxCountry(customer.vatNumber),
    eLocation: customer.eLocation || "",
    eAddress: customer.eAddress || "",
  };
}

function buildAddress(form: BuyerForm) {
  return [form.address, form.postCode, form.city].filter(Boolean).join(", ");
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function lineVatAmount(line: EditableLine) {
  if (["Z", "E", "AE", "O", "G", "IC"].includes(line.vatCategory)) return 0;
  return round2(Number(line.quantity || 0) * Number(line.price || 0) * (Number(line.vatRate || 0) / 100));
}

export default function NewInvoicePage() {
  const [profile, setProfile] = useState<InvoiceProfile>("standard");
  const [profileData, setProfileData] = useState<ProfileDataState>(() => ({
    standard: {},
    hr: {
      issueTime: nowTime(),
      businessProcessType: "P1",
      operatorCode: "Operater1",
      isCopy: false,
      selfBilling: false,
    },
    ujp: {},
    bank: {},
  }));
  const [activeCompany, setActiveCompany] = useState<ActiveCompany | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerVat, setSelectedCustomerVat] = useState("");
  const [buyer, setBuyer] = useState<BuyerForm>(emptyBuyer);
  const [invoiceId] = useState(() => Date.now());
  const [createdAt] = useState(() => new Date().toISOString());

  const [invoiceNumberNumericPart, setInvoiceNumberNumericPart] = useState("1");
  const [businessPremiseCode, setBusinessPremiseCode] = useState("PP01");
  const [deviceCode, setDeviceCode] = useState("01");
  const [issueDate, setIssueDate] = useState(today());
  const [issueTime] = useState(nowTime());
  const [serviceDate, setServiceDate] = useState(today());
  const [dueDate, setDueDate] = useState(addDays(15));
  const [isCopy] = useState(false);

  const [documentType, setDocumentType] = useState("380");
  const [businessProcess, setBusinessProcess] = useState("P1");
  const [note, setNote] = useState("");

  const [paymentMeansCode, setPaymentMeansCode] = useState("58");
  const [purposeCode, setPurposeCode] = useState("OTHR");
  const [bankAccount, setBankAccount] = useState("");
  const [bankBic, setBankBic] = useState("");
  const [reference, setReference] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");

  const [orderReference, setOrderReference] = useState("");
  const [contractReference, setContractReference] = useState("");
  const [deliveryNoteReference, setDeliveryNoteReference] = useState("");
  const [buyerReference, setBuyerReference] = useState("");

  const [lines, setLines] = useState<EditableLine[]>([
    {
      id: 1,
      itemCode: "SERV-001",
      description: "Svetovanje",
      itemDescription: "",
      quantity: 1,
      unit: "H87",
      price: 100,
      vatRate: 22,
      vatCategory: "S",
      hrVatCategoryCode: "",
      taxExemptionReason: "",
      kpdCode: "",
      kpdListId: "CG",
    },
  ]);

  const [toast, setToast] = useState("");

  const invoiceNumber = useMemo(
    () => `${invoiceNumberNumericPart}-${businessPremiseCode}-${deviceCode}`,
    [businessPremiseCode, deviceCode, invoiceNumberNumericPart]
  );

  useEffect(() => {
    const company = safeJsonParse<ActiveCompany | null>(
      localStorage.getItem("activeCompany"),
      null
    );
    const savedCustomers = safeJsonParse<Customer[]>(
      localStorage.getItem("customers"),
      []
    );
    const settings = safeJsonParse<CompanySettings>(
      localStorage.getItem("companySettings"),
      {}
    );
    const params = new URLSearchParams(window.location.search);
    const vat = params.get("vat");

    queueMicrotask(() => {
      const nextPart = nextInvoiceNumberPart();

      setActiveCompany(company);
      setCustomers(savedCustomers);
      setInvoiceNumberNumericPart(nextPart);
      setReference(`SI00-${nextPart}PP0101`);
      setBankAccount(settings.iban || "");
      setBankBic(settings.bic || "");

      if (company?.taxId || company?.vatNumber) {
        const operatorOib = (company.taxId || company.vatNumber || "")
          .replace(/\D/g, "")
          .slice(0, 11);

        setProfileData((current) => ({
          ...current,
          hr: {
            ...current.hr,
            operatorOib,
          },
        }));
      }

      if (settings.defaultDueDays) {
        setDueDate(addDays(Number(settings.defaultDueDays) || 15));
      }

      if (vat) {
        const selected = savedCustomers.find(
          (customer) => normalizeVat(customer.vatNumber) === normalizeVat(vat)
        );

        if (selected) {
          setSelectedCustomerVat(selected.vatNumber);
          setBuyer(customerToBuyer(selected));
        }
      }
    });
  }, []);

  const selectedProfile = useMemo(
    () => invoiceProfiles.find((item) => item.id === profile) || invoiceProfiles[0],
    [profile]
  );

  const currentProfileData = profileData[profile] || {};
  const lineProfileFields = selectedProfile.profileFields.filter(
    (field) => field.scope === "line"
  );

  function updateProfileField(name: string, value: ProfileFieldValue) {
    setProfileData((current) => ({
      ...current,
      [profile]: {
        ...current[profile],
        [name]: value,
      },
    }));
  }

  function profileString(
    data: Record<string, ProfileFieldValue>,
    name: string,
    fallback = ""
  ) {
    const value = data[name];
    return typeof value === "string" ? value : fallback;
  }

  function profileBoolean(
    data: Record<string, ProfileFieldValue>,
    name: string,
    fallback = false
  ) {
    const value = data[name];
    return typeof value === "boolean" ? value : fallback;
  }

  const totals = useMemo(() => {
    const net = round2(
      lines.reduce(
        (sum, line) => sum + Number(line.quantity || 0) * Number(line.price || 0),
        0
      )
    );
    const vat = round2(lines.reduce((sum, line) => sum + lineVatAmount(line), 0));

    return {
      net,
      vat,
      gross: round2(net + vat),
      payable: round2(net + vat),
    };
  }, [lines]);

  function buildInvoice(): Invoice {
    const sellerVat = activeCompany?.vatNumber || activeCompany?.taxId || "";
    const hrData = profileData.hr;
    const ujpData = profileData.ujp;
    const bankData = profileData.bank;
    const hrIssueTime = profileString(hrData, "issueTime", issueTime);
    const hrBusinessProcess = profileString(
      hrData,
      "businessProcessType",
      businessProcess
    );
    const hrOperatorOib = profileString(hrData, "operatorOib");
    const hrOperatorCode = profileString(hrData, "operatorCode", "Operater1");
    const bankPaymentReference = profileString(bankData, "paymentReference", reference);
    const bankPurposeCode = profileString(bankData, "purposeCode", purposeCode);
    const bankPaymentMeansCode = profileString(
      bankData,
      "paymentMeansCode",
      paymentMeansCode
    );

    return {
      id: invoiceId,
      profile,
      number: invoiceNumber,
      invoiceNumberNumericPart,
      businessPremiseCode,
      deviceCode,
      issueDate,
      issueTime: hrIssueTime,
      serviceDate,
      dueDate,
      currency: "EUR",
      documentType,
      businessProcess: hrBusinessProcess,
      isCopy: profileBoolean(hrData, "isCopy", isCopy),
      note,
      operator: {
        oib: hrOperatorOib,
        code: hrOperatorCode,
      },
      hrData: {
        invoiceNumberNumericPart,
        businessPremiseCode,
        deviceCode,
        issueTime: hrIssueTime,
        businessProcessType: hrBusinessProcess,
        p99BuyerProcessId: profileString(hrData, "p99BuyerProcessId"),
        operatorOib: hrOperatorOib,
        operatorCode: hrOperatorCode,
        operatorName: hrOperatorCode,
        isCopy: profileBoolean(hrData, "isCopy"),
        selfBilling: profileBoolean(hrData, "selfBilling"),
        previousInvoiceNumber: profileString(hrData, "previousInvoiceNumber"),
        previousInvoiceDate: profileString(hrData, "previousInvoiceDate"),
      },
      seller: {
        name: activeCompany?.name || "",
        vat: sellerVat,
        taxId: sellerVat,
        oib: sellerVat.replace(/\D/g, "").slice(0, 11),
        address: activeCompany?.address || "",
        postCode: activeCompany?.postCode || "",
        city: activeCompany?.city || "",
        country: activeCompany?.country || taxCountry(sellerVat),
        eLocation: activeCompany?.eLocation || "",
        eAddress: activeCompany?.eAddress || "",
        endpointId: sellerVat.replace(/\D/g, "").slice(0, 11) || sellerVat,
        endpointSchemeId: "9934",
      },
      buyer: {
        name: buyer.name,
        vat: buyer.vat,
        taxId: buyer.vat,
        oib: buyer.vat.replace(/\D/g, "").slice(0, 11),
        address: buildAddress(buyer),
        street: buyer.address,
        postCode: buyer.postCode,
        city: buyer.city,
        country: buyer.country,
        eLocation: buyer.eLocation,
        eAddress: buyer.eAddress,
        endpointId: buyer.vat.replace(/\D/g, "").slice(0, 11) || buyer.vat,
        endpointSchemeId: "9934",
      },
      payment: {
        paymentMeansCode: bankPaymentMeansCode,
        purposeCode: bankPurposeCode,
        bankAccount,
        iban: bankAccount,
        bankBic,
        bic: bankBic,
        reference: bankPaymentReference,
        paymentTerms,
      },
      references: {
        orderReference,
        contractReference,
        deliveryNoteReference,
        buyerReference,
      },
      ujpData: {
        orderReference,
        contractReference,
        deliveryNoteReference,
        buyerReference,
        budgetUser: profileString(ujpData, "budgetUser"),
        ujpRecipient: profileString(ujpData, "ujpRecipient"),
        publicProcurementReference: profileString(
          ujpData,
          "publicProcurementReference"
        ),
        additionalReference: profileString(ujpData, "additionalReference"),
      },
      bankData: {
        payeeIban: bankAccount,
        payeeBic: bankBic,
        paymentModel: profileString(bankData, "paymentModel"),
        paymentReference: bankPaymentReference,
        purposeCode: bankPurposeCode,
        paymentMeansCode: bankPaymentMeansCode,
        payerName: profileString(bankData, "payerName"),
        payeeName: profileString(bankData, "payeeName"),
      },
      lines,
      totals,
      eSlog: {
        specificationIdentifier: "urn:cen.eu:en16931:2017",
        documentType,
        businessProcess: hrBusinessProcess,
        paymentMeansCode: bankPaymentMeansCode,
        purposeCode: bankPurposeCode,
        profileId: hrBusinessProcess,
      },
      createdAt,
    };
  }

  const prepared = prepareInvoiceForEslog(buildInvoice());

  function updateLine(id: number, patch: Partial<EditableLine>) {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== id) return line;

        const next = { ...line, ...patch };
        if (["Z", "E", "AE", "O", "G", "IC"].includes(next.vatCategory)) {
          next.vatRate = 0;
        }

        return next;
      })
    );
  }

  function addLine() {
    setLines((current) => [
      ...current,
      {
        id: Date.now(),
        description: "",
        quantity: 1,
        price: 0,
        vatRate: 22,
        unit: "H87",
        vatCategory: "S",
        hrVatCategoryCode: "",
        taxExemptionReason: "",
        kpdCode: "",
        kpdListId: "CG",
      },
    ]);
  }

  function removeLine(id: number) {
    setLines((current) =>
      current.length === 1 ? current : current.filter((line) => line.id !== id)
    );
  }

  function saveDraft() {
    const invoice = buildInvoice();
    const drafts = safeJsonParse<Invoice[]>(localStorage.getItem("drafts"), []);

    localStorage.setItem("drafts", JSON.stringify([invoice, ...drafts]));
    setToast("Osnutek računa je shranjen.");
  }

  function continueToPreview() {
    if (!activeCompany) {
      setToast("Najprej izberi aktivno podjetje v zgornjem izbirniku.");
      return;
    }

    const invoice = prepared.invoice;
    localStorage.setItem("eracunko_current_invoice", JSON.stringify(invoice));
    window.location.href = "/invoices/preview";
  }

  return (
    <AppShell>
      {toast && (
        <div className="glass-panel fixed right-5 top-5 z-50 max-w-md rounded-2xl px-5 py-4 text-sm">
          {toast}
        </div>
      )}

      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="status-pill mb-4 inline-flex">eSLOG 2.0 / EN16931</div>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Nov račun
          </h1>
          <p className="app-muted mt-3 max-w-2xl">
            Vnesi vse podatke, ki jih potrebujeta eSLOG XML in bizBox ovojnica.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={saveDraft} className="secondary-button h-12 px-6">
            <Save className="h-4 w-4" aria-hidden="true" />
            Shrani osnutek
          </button>

          <button onClick={continueToPreview} className="primary-button h-12 px-6">
            Nadaljuj
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <section className="solid-panel mb-8 rounded-[1.75rem] p-3">
        <div className="grid gap-2 md:grid-cols-4">
          {invoiceProfiles.map((invoiceProfile) => (
            <button
              key={invoiceProfile.id}
              onClick={() => setProfile(invoiceProfile.id)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                profile === invoiceProfile.id
                  ? "border-[var(--app-primary)] bg-[var(--app-soft)] text-[var(--app-primary-strong)]"
                  : "border-[var(--app-border)] hover:bg-[var(--app-soft)]"
              }`}
            >
              <div className="font-semibold">{invoiceProfile.label}</div>
              <div className="app-muted mt-1 text-xs">{invoiceProfile.description}</div>
            </button>
          ))}
        </div>
      </section>

      {!activeCompany && (
        <section className="mb-8 rounded-[1.75rem] border border-amber-500/25 bg-amber-500/10 p-5 text-amber-500">
          Aktivno podjetje ni izbrano. Izberi ga v zgornjem izbirniku podjetij.
        </section>
      )}

      <div className="grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-8">
          <section className="solid-panel rounded-[1.75rem] p-6">
            <SectionHeader title="Podatki računa" icon={<FilePlus2 className="h-5 w-5 text-[var(--app-primary)]" />} />
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Zaporedna stevilka">
                <input value={invoiceNumberNumericPart} onChange={(event) => setInvoiceNumberNumericPart(event.target.value)} className="field-input" />
              </Field>
              <Field label="Poslovni prostor">
                <input value={businessPremiseCode} onChange={(event) => setBusinessPremiseCode(event.target.value)} className="field-input" />
              </Field>
              <Field label="Naprava">
                <input value={deviceCode} onChange={(event) => setDeviceCode(event.target.value)} className="field-input" />
              </Field>
              <Info label="Stevilka racuna" value={invoiceNumber} />
              <Field label="Tip dokumenta">
                <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="field-input">
                  <option value="380">380 - Racun</option>
                  <option value="381">381 - Dobropis</option>
                  <option value="383">383 - Breme</option>
                </select>
              </Field>
              <Field label="Poslovni proces">
                <input value={businessProcess} onChange={(event) => setBusinessProcess(event.target.value)} className="field-input" placeholder="P1 ali P99:kupec" />
              </Field>
              <Field label="Datum izdaje">
                <input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} className="field-input" />
              </Field>
              <Field label="Datum storitve">
                <input type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} className="field-input" />
              </Field>
              <Field label="Rok placila">
                <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="field-input" />
              </Field>
            </div>
          </section>

          <ProfileFieldsSection
            profile={selectedProfile}
            values={currentProfileData}
            onChange={updateProfileField}
          />

          <section className="solid-panel rounded-[1.75rem] p-6">
            <SectionHeader
              title="Kupec"
              description="Izberi stranko ali dopolni podatke rocno."
              action={<Link href="/customers/new" className="text-sm font-semibold text-[var(--app-primary-strong)]">Dodaj stranko</Link>}
            />
            <select
              value={selectedCustomerVat}
              onChange={(event) => {
                const selected = customers.find((customer) => customer.vatNumber === event.target.value);
                setSelectedCustomerVat(event.target.value);
                setBuyer(selected ? customerToBuyer(selected) : emptyBuyer());
              }}
              className="field-input"
            >
              <option value="">Rocni vnos ali izberi kupca...</option>
              {customers.map((customer) => (
                <option key={customer.vatNumber} value={customer.vatNumber}>
                  {customer.name} - {customer.vatNumber}
                </option>
              ))}
            </select>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <BuyerField label="Naziv" field="name" buyer={buyer} setBuyer={setBuyer} />
              <BuyerField label="VAT/OIB" field="vat" buyer={buyer} setBuyer={setBuyer} />
              <BuyerField label="Naslov" field="address" buyer={buyer} setBuyer={setBuyer} />
              <BuyerField label="Postna stevilka" field="postCode" buyer={buyer} setBuyer={setBuyer} />
              <BuyerField label="Mesto" field="city" buyer={buyer} setBuyer={setBuyer} />
              <BuyerField label="Drzava" field="country" buyer={buyer} setBuyer={setBuyer} />
              <BuyerField label="eLokacija" field="eLocation" buyer={buyer} setBuyer={setBuyer} />
              <BuyerField label="eAddress" field="eAddress" buyer={buyer} setBuyer={setBuyer} />
            </div>
          </section>

          <section className="solid-panel rounded-[1.75rem] p-6">
            <SectionHeader title="Reference" />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Narocilo">
                <input value={orderReference} onChange={(event) => setOrderReference(event.target.value)} className="field-input" />
              </Field>
              <Field label="Pogodba">
                <input value={contractReference} onChange={(event) => setContractReference(event.target.value)} className="field-input" />
              </Field>
              <Field label="Dobavnica">
                <input value={deliveryNoteReference} onChange={(event) => setDeliveryNoteReference(event.target.value)} className="field-input" />
              </Field>
              <Field label="Referenca kupca">
                <input value={buyerReference} onChange={(event) => setBuyerReference(event.target.value)} className="field-input" />
              </Field>
            </div>
          </section>

          <section className="solid-panel rounded-[1.75rem] p-6">
            <SectionHeader
              title="Postavke"
              description="BT-131, BT-146, BT-151, BT-152 in HR KPD podatki."
              action={<button onClick={addLine} className="secondary-button h-10 px-4"><Plus className="h-4 w-4" aria-hidden="true" />Dodaj</button>}
            />

            <div className="space-y-4">
              {lines.map((line, index) => (
                <div key={line.id} className="rounded-[1.25rem] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="status-pill">Postavka {index + 1}</span>
                    <button onClick={() => removeLine(line.id)} className="rounded-xl border border-red-500/25 px-3 py-2 text-red-500 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-6">
                    <Field label="Sifra">
                      <input value={line.itemCode || ""} onChange={(event) => updateLine(line.id, { itemCode: event.target.value })} className="field-input" />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Naziv/opis">
                        <input value={line.description} onChange={(event) => updateLine(line.id, { description: event.target.value })} className="field-input" />
                      </Field>
                    </div>
                    <Field label="Kolicina">
                      <input type="number" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: Number(event.target.value) })} className="field-input" />
                    </Field>
                    <Field label="Enota">
                      <input value={line.unit || ""} onChange={(event) => updateLine(line.id, { unit: event.target.value })} className="field-input" />
                    </Field>
                    <Field label="Neto cena">
                      <input type="number" value={line.price} onChange={(event) => updateLine(line.id, { price: Number(event.target.value) })} className="field-input" />
                    </Field>
                    <Field label="DDV kategorija">
                      <select value={line.vatCategory} onChange={(event) => updateLine(line.id, { vatCategory: event.target.value as VatCategory })} className="field-input">
                        {VAT_CATEGORIES.map((category) => (
                          <option key={category.value} value={category.value}>{category.label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="DDV %">
                      <input type="number" value={line.vatRate} onChange={(event) => updateLine(line.id, { vatRate: Number(event.target.value) })} className="field-input" />
                    </Field>
                    {lineProfileFields.map((field) => (
                      <LineProfileField
                        key={field.name}
                        field={field}
                        line={line}
                        onChange={(value) =>
                          updateLine(line.id, {
                            [field.name]: value,
                            ...(field.name === "kpdCode" ? { kpdListId: "CG" } : {}),
                          } as Partial<EditableLine>)
                        }
                      />
                    ))}
                    <div className="md:col-span-2">
                      <Field label="Razlog oprostitve">
                        <input value={line.taxExemptionReason || ""} onChange={(event) => updateLine(line.id, { taxExemptionReason: event.target.value })} className="field-input" />
                      </Field>
                    </div>
                    <div className="md:col-span-6">
                      <Field label="Dodatni opis">
                        <input value={line.itemDescription || line.note || ""} onChange={(event) => updateLine(line.id, { itemDescription: event.target.value })} className="field-input" />
                      </Field>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="solid-panel rounded-[1.75rem] p-6">
            <SectionHeader title="Placilo" />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Payment means code">
                <select value={paymentMeansCode} onChange={(event) => setPaymentMeansCode(event.target.value)} className="field-input">
                  <option value="58">58 - SEPA kreditni transfer</option>
                  <option value="30">30 - Kreditno nakazilo</option>
                  <option value="10">10 - Gotovina</option>
                </select>
              </Field>
              <Field label="Koda namena">
                <input value={purposeCode} onChange={(event) => setPurposeCode(event.target.value)} className="field-input" />
              </Field>
              <Field label="IBAN">
                <input value={bankAccount} onChange={(event) => setBankAccount(event.target.value)} className="field-input" />
              </Field>
              <Field label="BIC">
                <input value={bankBic} onChange={(event) => setBankBic(event.target.value)} className="field-input" />
              </Field>
              <Field label="Sklic">
                <input value={reference} onChange={(event) => setReference(event.target.value)} className="field-input" />
              </Field>
              <Field label="Placilni pogoji">
                <input value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} className="field-input" />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Opomba">
                <textarea value={note} onChange={(event) => setNote(event.target.value)} className="field-input min-h-28 resize-none" />
              </Field>
            </div>
          </section>

        </div>

        <aside className="space-y-8">
          <section className="glass-panel rounded-[1.75rem] p-6">
            <h2 className="text-xl font-semibold">Povzetek</h2>
            <div className="app-muted mt-1 text-sm">
              Profil: {invoiceProfiles.find((item) => item.id === profile)?.label}
            </div>
            <div className="mt-5 space-y-3 text-sm">
              <SummaryRow label="BT-106 neto" value={`${prepared.invoice.totals.net.toFixed(2)} EUR`} />
              <SummaryRow label="BT-110 DDV" value={`${prepared.invoice.totals.vat.toFixed(2)} EUR`} />
              <SummaryRow label="BT-112 bruto" value={`${prepared.invoice.totals.gross.toFixed(2)} EUR`} />
              <SummaryRow label="BT-115 za placilo" value={`${(prepared.invoice.totals.payable || prepared.invoice.totals.gross).toFixed(2)} EUR`} strong />
            </div>
          </section>

          <ValidationPanel errors={prepared.validation.errors} warnings={prepared.validation.warnings} />

          <section className="solid-panel rounded-[1.75rem] p-6">
            <h2 className="text-xl font-semibold">DDV breakdown</h2>
            <div className="mt-4 space-y-3 text-sm">
              {(prepared.invoice.vatBreakdown || []).map((item) => (
                <div key={`${item.vatCategory}-${item.vatRate}`} className="rounded-2xl bg-[var(--app-soft)] p-4">
                  <div className="font-semibold">{item.vatCategory} / {item.vatRate}%</div>
                  <div className="app-muted mt-1">Osnova {item.taxableAmount.toFixed(2)} EUR · DDV {item.vatAmount.toFixed(2)} EUR</div>
                </div>
              ))}
            </div>
          </section>

          <section className="solid-panel rounded-[1.75rem] p-6">
            <div className="mb-4 flex items-center gap-2">
              <FileCode2 className="h-5 w-5 text-[var(--app-primary)]" />
              <h2 className="text-xl font-semibold">XML predogled</h2>
            </div>
            <pre className="max-h-[520px] overflow-auto rounded-2xl border border-[var(--app-border)] bg-[var(--app-soft)] p-4 text-xs leading-relaxed app-muted">
              {prepared.xml || "XML bo generiran, ko so odpravljene obvezne napake."}
            </pre>
          </section>

          {process.env.NODE_ENV !== "production" && (
            <section className="solid-panel rounded-[1.75rem] p-6">
              <h2 className="text-xl font-semibold">Debug profil</h2>
              <pre className="mt-4 max-h-80 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-blue-100">
                {JSON.stringify(
                  {
                    profile: prepared.invoice.profile,
                    profileData: currentProfileData,
                    validationErrors: prepared.validation.errors,
                  },
                  null,
                  2
                )}
              </pre>
            </section>
          )}
        </aside>
      </div>
    </AppShell>
  );
}

function BuyerField({
  label,
  field,
  buyer,
  setBuyer,
}: {
  label: string;
  field: keyof BuyerForm;
  buyer: BuyerForm;
  setBuyer: React.Dispatch<React.SetStateAction<BuyerForm>>;
}) {
  return (
    <Field label={label}>
      <input
        value={buyer[field]}
        onChange={(event) =>
          setBuyer((current) => ({ ...current, [field]: event.target.value }))
        }
        className="field-input"
      />
    </Field>
  );
}

function ProfileFieldsSection({
  profile,
  values,
  onChange,
}: {
  profile: (typeof invoiceProfiles)[number];
  values: Record<string, ProfileFieldValue>;
  onChange: (name: string, value: ProfileFieldValue) => void;
}) {
  if (profile.profileFields.length === 0) return null;
  const invoiceFields = profile.profileFields.filter(
    (field) => field.scope !== "line"
  );

  if (invoiceFields.length === 0) return null;

  return (
    <section className="solid-panel rounded-[1.75rem] p-6">
      <SectionHeader title={profile.label} description={profile.description} />
      <div className="grid gap-4 md:grid-cols-2">
        {invoiceFields.map((field) => (
          <ProfileField
            key={field.name}
            field={field}
            value={values[field.name]}
            onChange={(value) => onChange(field.name, value)}
          />
        ))}
      </div>
    </section>
  );
}

function LineProfileField({
  field,
  line,
  onChange,
}: {
  field: ProfileFieldDefinition;
  line: EditableLine;
  onChange: (value: ProfileFieldValue) => void;
}) {
  const lineValue = line[field.name as keyof EditableLine];
  const value =
    typeof lineValue === "string" || typeof lineValue === "boolean"
      ? lineValue
      : lineValue == null
        ? ""
        : String(lineValue);

  return (
    <ProfileField field={field} value={value} onChange={onChange} />
  );
}

function ProfileField({
  field,
  value,
  onChange,
}: {
  field: ProfileFieldDefinition;
  value: ProfileFieldValue | undefined;
  onChange: (value: ProfileFieldValue) => void;
}) {
  const label = `${field.label}${field.required ? " *" : ""}`;
  const wrapperClass = field.span === "full" ? "md:col-span-2" : "";

  if (field.type === "checkbox") {
    return (
      <label className={`flex items-start gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 ${wrapperClass}`}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="block font-medium">{label}</span>
          {field.helper && (
            <span className="app-muted mt-1 block text-sm">{field.helper}</span>
          )}
        </span>
      </label>
    );
  }

  return (
    <div className={wrapperClass}>
      <Field label={label}>
        {field.type === "select" ? (
          <select
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
            className="field-input"
          >
            <option value="">Izberi...</option>
            {(field.options || []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={field.type === "date" ? "date" : field.type === "time" ? "text" : "text"}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
            className="field-input"
            placeholder={field.placeholder || (field.type === "time" ? "HH:MM:SS" : undefined)}
          />
        )}
      </Field>
      {field.helper && (
        <p className="app-muted mt-2 text-xs">{field.helper}</p>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {description && <p className="app-muted mt-1 text-sm">{description}</p>}
      </div>
      {action || icon}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="app-muted mb-2 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
      <span className="app-muted">{label}:</span> {value || "-"}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3 last:border-b-0">
      <span className="app-muted">{label}</span>
      <span className={strong ? "text-lg font-semibold" : "font-medium"}>
        {value}
      </span>
    </div>
  );
}

function ValidationPanel({
  errors,
  warnings,
}: {
  errors: string[];
  warnings: string[];
}) {
  if (errors.length === 0 && warnings.length === 0) {
    return (
      <section className="rounded-[1.75rem] border border-emerald-500/20 bg-emerald-500/10 p-6 text-emerald-500">
        Racun je pripravljen za eSLOG generiranje.
      </section>
    );
  }

  return (
    <section className="solid-panel rounded-[1.75rem] p-6">
      <h2 className="text-xl font-semibold">Validacija</h2>
      {errors.length > 0 && (
        <div className="mt-4 rounded-2xl bg-red-500/10 p-4 text-sm text-red-500">
          <strong>Napake</strong>
          <ul className="mt-2 list-disc pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="mt-4 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-500">
          <strong>Opozorila</strong>
          <ul className="mt-2 list-disc pl-5">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
