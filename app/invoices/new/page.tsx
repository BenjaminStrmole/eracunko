"use client";

import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  FilePlus2,
  ListChecks,
  Plus,
  ReceiptText,
  Save,
  Send,
  Trash2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadActiveCompanyWithFallback } from "../../../lib/client/activeCompany";
import { loadCustomersWithFallback } from "../../../lib/client/customers";
import { prependLocalDraft, saveDbDraft } from "../../../lib/client/invoiceDrafts";
import { invoiceProfiles } from "../../../lib/eslog/invoiceProfiles";
import { normalizePartyAddress } from "../../../lib/eslog/normalizeInvoice";
import { prepareInvoiceForEslog } from "../../../lib/eslog/prepareInvoiceForEslog";
import type { ProfileFieldDefinition } from "../../../lib/eslog/profiles/types";
import type {
  Invoice,
  InvoiceLine,
  InvoiceProfile,
  VatCategory,
} from "../../../types/invoice";
import AppShell from "../../components/AppShell";
import { useToast } from "../../components/ToastProvider";

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
  registrationNumber?: string;
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
  street?: string;
  postCode?: string;
  city?: string;
  country?: string;
  locationId?: string;
  registrationNumber?: string;
};

type CompanySellerSettings = ActiveCompany & {
  registrationNumber?: string;
  iban?: string;
  bic?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  completeForEslog?: boolean;
};

type CompanySettings = {
  iban?: string;
  bic?: string;
  defaultDueDays?: string;
  invoicePrefix?: string;
  registrationNumber?: string;
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
  registrationNumber: string;
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

const WIZARD_STEPS = [
  {
    title: "Prejemnik",
    shortTitle: "Prejemnik",
    description: "Izberi kupca in vrsto racuna. Tehnicne podatke prikazemo sele, ko so potrebni.",
    icon: UserRound,
  },
  {
    title: "Podatki racuna",
    shortTitle: "Racun",
    description: "Osnovni datumi, stevilka racuna, placilo in reference za izbrani nacin posiljanja.",
    icon: FilePlus2,
  },
  {
    title: "Postavke",
    shortTitle: "Postavke",
    description: "Dodaj storitve ali izdelke. DDV in zneske izracunamo sproti.",
    icon: ReceiptText,
  },
  {
    title: "Pregled",
    shortTitle: "Pregled",
    description: "Preveri kupca, postavke, zneske in validacijska opozorila pred pripravo XML-ja.",
    icon: ClipboardCheck,
  },
  {
    title: "Posiljanje",
    shortTitle: "Poslji",
    description: "Pripravi racun za koncni eSLOG pregled in oddajo prek bizBox.",
    icon: Send,
  },
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
    registrationNumber: "",
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
    registrationNumber: customer.registrationNumber || "",
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
  const toast = useToast();
  const [profile, setProfile] = useState<InvoiceProfile>("standard");
  const [step, setStep] = useState(0);
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
  const [companySellerSettings, setCompanySellerSettings] = useState<CompanySellerSettings | null>(null);
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
  const [specificationIdentifier, setSpecificationIdentifier] = useState("urn:cen.eu:en16931:2017");
  const [note, setNote] = useState("");

  const [paymentMeansCode, setPaymentMeansCode] = useState("58");
  const [purposeCode, setPurposeCode] = useState("OTHR");
  const [paymentPurpose, setPaymentPurpose] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankBic, setBankBic] = useState("");
  const [reference, setReference] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [sellerRegistrationNumber, setSellerRegistrationNumber] = useState("");

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

  const invoiceNumber = useMemo(
    () => `${invoiceNumberNumericPart}-${businessPremiseCode}-${deviceCode}`,
    [businessPremiseCode, deviceCode, invoiceNumberNumericPart]
  );

  useEffect(() => {
    let savedCustomers: Customer[] = [];
    const settings = safeJsonParse<CompanySettings>(
      localStorage.getItem("companySettings"),
      {}
    );
    const params = new URLSearchParams(window.location.search);
    const vat = params.get("vat");

    queueMicrotask(async () => {
      const company = (await loadActiveCompanyWithFallback()) as ActiveCompany | null;
      savedCustomers = (await loadCustomersWithFallback()) as Customer[];
      const nextPart = nextInvoiceNumberPart();
      let dbCompanySettings: CompanySellerSettings | null = null;

      try {
        const response = await fetch("/api/settings/company", { cache: "no-store" });
        const data = await response.json();
        if (response.ok && data.success && data.company) {
          dbCompanySettings = data.company as CompanySellerSettings;
        }
      } catch {}

      setActiveCompany(company);
      setCompanySellerSettings(dbCompanySettings);
      setCustomers(savedCustomers);
      setInvoiceNumberNumericPart(nextPart);
      setReference(`SI00-${nextPart}PP0101`);
      setBankAccount(dbCompanySettings?.iban || settings.iban || "");
      setBankBic(dbCompanySettings?.bic || settings.bic || "");
      setSellerRegistrationNumber(
        dbCompanySettings?.registrationNumber ||
          company?.registrationNumber ||
          settings.registrationNumber ||
          ""
      );

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
    const sellerSource = {
      ...(activeCompany || {}),
      ...(companySellerSettings || {}),
    };
    const sellerVat = sellerSource.vatNumber || sellerSource.taxId || "";
    const sellerAddress = normalizePartyAddress({
      name: sellerSource.name || "",
      vat: sellerVat,
      taxId: sellerVat,
      oib: sellerVat.replace(/\D/g, "").slice(0, 11),
      address: sellerSource.address || "",
      street: sellerSource.street,
      postCode: sellerSource.postCode,
      city: sellerSource.city,
      country: sellerSource.country || taxCountry(sellerVat),
      eLocation: sellerSource.eLocation || "",
      eAddress: sellerSource.eAddress || "",
      endpointId: sellerVat.replace(/\D/g, "").slice(0, 11) || sellerVat,
      endpointSchemeId: "9934",
      registrationNumber: sellerRegistrationNumber || sellerSource.registrationNumber,
      contactName: sellerSource.contactName,
      contactEmail: sellerSource.contactEmail,
    });
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
        ...sellerAddress,
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
        registrationNumber: buyer.registrationNumber,
      },
      payment: {
        paymentMeansCode: bankPaymentMeansCode,
        purposeCode: bankPurposeCode,
        bankAccount,
        iban: bankAccount,
        bankBic,
        bic: bankBic,
        reference: bankPaymentReference,
        paymentPurpose,
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
        specificationIdentifier,
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

  async function saveDraft() {
    const invoice = buildInvoice();

    try {
      const savedDraft = await saveDbDraft(invoice);
      prependLocalDraft(savedDraft);
      toast.success("Osnutek je shranjen", "Račun je shranjen v bazo osnutkov.");
    } catch {
      prependLocalDraft(invoice);
      toast.warning(
        "Osnutek je shranjen lokalno",
        "Shranjevanje v bazo ni uspelo, zato je osnutek začasno shranjen v tem brskalniku."
      );
    }
  }

  function validateWizardStep(stepIndex: number) {
    if (stepIndex === 0) {
      if (!activeCompany) {
        toast.warning(
          "Manjka aktivno podjetje",
          "Najprej izberi podjetje, ki bo izdalo racun."
        );
        return false;
      }

      if (!buyer.name.trim()) {
        toast.warning("Manjka prejemnik", "Vnesi naziv kupca ali izberi stranko.");
        return false;
      }

      if (!buyer.vat.trim() && !buyer.eLocation.trim() && !buyer.eAddress.trim()) {
        toast.warning(
          "Manjka identifikacija kupca",
          "Dodaj davcno stevilko, eLokacijo ali e-naslov prejemnika."
        );
        return false;
      }
    }

    if (stepIndex === 1) {
      if (!invoiceNumberNumericPart.trim()) {
        toast.warning("Manjka stevilka racuna", "Vnesi zaporedno stevilko racuna.");
        return false;
      }

      if (!issueDate || !serviceDate || !dueDate) {
        toast.warning("Manjkajo datumi", "Vnesi datum izdaje, datum storitve in rok placila.");
        return false;
      }
    }

    if (stepIndex === 2) {
      const invalidLine = lines.find(
        (line) =>
          !line.description.trim() ||
          Number(line.quantity || 0) <= 0 ||
          Number(line.price || 0) < 0
      );

      if (invalidLine) {
        toast.warning(
          "Preveri postavke",
          "Vsaka postavka potrebuje opis, kolicino vecjo od 0 in veljavno ceno."
        );
        return false;
      }
    }

    return true;
  }

  function goNext() {
    if (!validateWizardStep(step)) return;
    setStep((current) => Math.min(current + 1, WIZARD_STEPS.length - 1));
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, 0));
  }

  function prepareForSending() {
    if (!activeCompany) {
      toast.warning(
        "Manjka aktivno podjetje",
        "Najprej izberi aktivno podjetje v zgornjem izbirniku."
      );
      return;
    }

    if (prepared.validation.errors.length > 0) {
      toast.error(
        "Račun ima validacijske napake",
        prepared.validation.errors.slice(0, 2).join(" ")
      );
      setStep(3);
      return;
    } else if (prepared.validation.warnings.length > 0) {
      toast.warning(
        "Račun ima opozorila",
        prepared.validation.warnings.slice(0, 2).join(" ")
      );
    }

    const invoice = prepared.invoice;
    localStorage.setItem("eracunko_current_invoice", JSON.stringify(invoice));
    window.location.href = "/invoices/xml";
  }

  const isReferenceProfile = profile === "ujp" || profile === "bank";
  const currentStep = WIZARD_STEPS[step];
  const CurrentStepIcon = currentStep.icon;

  return (
    <AppShell>
      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="status-pill mb-4 inline-flex">Voden vnos racuna</div>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Nov račun
          </h1>
          <p className="app-muted mt-3 max-w-2xl">
            Korak za korakom vnesi samo podatke, ki jih ta trenutek potrebujes.
            eSLOG in bizBox podrobnosti ostanejo skrite, dokler niso pomembne.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={saveDraft} className="secondary-button h-12 px-6">
            <Save className="h-4 w-4" aria-hidden="true" />
            Shrani osnutek
          </button>
        </div>
      </div>

      {!activeCompany && (
        <section className="mb-8 rounded-[1.75rem] border border-amber-500/25 bg-amber-500/10 p-5 text-amber-500">
          Aktivno podjetje ni izbrano. Izberi ga v zgornjem izbirniku podjetij.
        </section>
      )}

      <WizardStepper currentStep={step} onStepChange={setStep} />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="solid-panel rounded-[1.75rem] p-6">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--app-soft)] text-[var(--app-primary)]">
                <CurrentStepIcon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <div className="app-muted text-sm">Korak {step + 1} od {WIZARD_STEPS.length}</div>
                <h2 className="text-2xl font-semibold">{currentStep.title}</h2>
                <p className="app-muted mt-1 max-w-2xl text-sm">{currentStep.description}</p>
              </div>
            </div>
            <div className="status-pill shrink-0">{selectedProfile.label}</div>
          </div>

          {step === 0 && (
            <div className="space-y-7" id="section-buyer-seller">
              <div id="section-profile">
                <SectionHeader
                  title="Vrsta racuna"
                  description="Izberi najblizji nacin posiljanja. Podatki, ki so posebni za profil, se prikazejo kasneje."
                />
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {invoiceProfiles.map((invoiceProfile) => (
                    <button
                      key={invoiceProfile.id}
                      onClick={() => setProfile(invoiceProfile.id)}
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        profile === invoiceProfile.id
                          ? "border-[var(--app-primary)] bg-[var(--app-soft)] text-[var(--app-primary-strong)]"
                          : "border-[var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-soft)]"
                      }`}
                    >
                      <div className="font-semibold">{invoiceProfile.label}</div>
                      <div className="app-muted mt-1 text-xs">{invoiceProfile.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div id="section-buyer">
                <SectionHeader
                  title="Kupec"
                  description="Izberi shranjeno stranko ali vnesi osnovne podatke rocno."
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
                  <BuyerField label="Naziv kupca" field="name" buyer={buyer} setBuyer={setBuyer} />
                  <BuyerField label="Davcna stevilka / OIB" field="vat" buyer={buyer} setBuyer={setBuyer} />
                  <BuyerField label="Naslov" field="address" buyer={buyer} setBuyer={setBuyer} />
                  <BuyerField label="Postna stevilka" field="postCode" buyer={buyer} setBuyer={setBuyer} />
                  <BuyerField label="Mesto" field="city" buyer={buyer} setBuyer={setBuyer} />
                  <BuyerField label="Drzava" field="country" buyer={buyer} setBuyer={setBuyer} />
                  <BuyerField label="eLokacija" field="eLocation" buyer={buyer} setBuyer={setBuyer} helper="Identifikator prejemnika v eSLOG/bizBox omrezju. Ce ga ne poznas, ga navadno vrne iskanje stranke." />
                </div>
                <details className="mt-5 rounded-[1.25rem] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                  <summary className="cursor-pointer font-semibold">Dodatna polja kupca</summary>
                  <p className="app-muted mt-2 text-sm">
                    Ta polja se uporabijo za elektronski naslov prejemnika, identifikatorje in registrske podatke, kadar jih prejemnik zahteva.
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <BuyerField label="e-naslov za prejem" field="eAddress" buyer={buyer} setBuyer={setBuyer} helper="BT-49; v XML se zapise kot elektronski naslov kupca, kadar je vnesen." />
                    <BuyerField label="Maticna stevilka kupca" field="registrationNumber" buyer={buyer} setBuyer={setBuyer} helper="BT-47; opcijski registrski identifikator kupca." />
                  </div>
                </details>
              </div>

              <div id="section-seller">
                <SectionHeader
                  title="Prodajalec"
                  description="Prodajalec se vzame iz aktivnega podjetja. Tukaj preveris podatke, ki gredo v eSLOG XML."
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <Info label="Naziv" value={activeCompany?.name || "-"} />
                  <Info label="Davcna stevilka" value={activeCompany?.vatNumber || activeCompany?.taxId || "-"} />
                  <Info label="Naslov" value={activeCompany?.address || "-"} />
                  <Info label="eLokacija" value={activeCompany?.eLocation || "-"} />
                </div>
                <details className="mt-5 rounded-[1.25rem] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                  <summary className="cursor-pointer font-semibold">Dodatna polja prodajalca</summary>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field label="Maticna stevilka prodajalca" helper="BT-30; opcijski registrski identifikator prodajalca. Ne spremeni aktivnega podjetja, shrani se na racun.">
                      <input value={sellerRegistrationNumber} onChange={(event) => setSellerRegistrationNumber(event.target.value)} className="field-input" />
                    </Field>
                  </div>
                </details>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-7">
              <div id="section-invoice-details">
                <SectionHeader title="Osnovni podatki" />
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
                      <option value="380">Racun</option>
                      <option value="381">Dobropis</option>
                      <option value="383">Breme</option>
                    </select>
                  </Field>
                  <Field
                    label="Poslovni proces"
                    helper="BT-23; pove prejemniku, v katerem poslovnem procesu obdeluje racun. Za osnovni e-racun pusti P1."
                  >
                    <select value={businessProcess} onChange={(event) => setBusinessProcess(event.target.value)} className="field-input">
                      <option value="P1">P1 - Osnovni racun</option>
                      <option value="P2">P2</option>
                      <option value="P3">P3</option>
                      <option value="P4">P4</option>
                      <option value="P5">P5</option>
                      <option value="P6">P6</option>
                      <option value="P7">P7</option>
                      <option value="P8">P8</option>
                      <option value="P9">P9</option>
                      <option value="P10">P10</option>
                      <option value="P11">P11</option>
                      <option value="P12">P12</option>
                    </select>
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
                <details className="mt-5 rounded-[1.25rem] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                  <summary className="cursor-pointer font-semibold">Dodatna polja eSLOG</summary>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field
                      label="Identifikator specifikacije"
                      helper="BT-24; pove, po katerih pravilih je pripravljen XML. Privzeto je EN16931 in ga spremeni samo, ce prejemnik to izrecno zahteva."
                    >
                      <input value={specificationIdentifier} onChange={(event) => setSpecificationIdentifier(event.target.value)} className="field-input" />
                    </Field>
                  </div>
                </details>
              </div>

              <div id="section-payment">
                <SectionHeader
                  title="Placilo"
                  description="Uporabniku prijazna polja za sklic, namen in placilni racun."
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nacin placila" helper="BT-81; za obicajno placilo na TRR uporabi SEPA kreditni transfer.">
                    <select value={paymentMeansCode} onChange={(event) => setPaymentMeansCode(event.target.value)} className="field-input">
                      <option value="58">SEPA kreditni transfer</option>
                      <option value="30">Kreditno nakazilo</option>
                      <option value="10">Gotovina</option>
                    </select>
                  </Field>
                  <Field label="Sklic placila" helper="BT-83; remittance information/sklic, ki poveze placilo z racunom. V XML se mapira kot RFF PQ.">
                    <input value={reference} onChange={(event) => setReference(event.target.value)} className="field-input" />
                  </Field>
                  <Field label="Namen placila">
                    <input value={paymentPurpose} onChange={(event) => setPaymentPurpose(event.target.value)} className="field-input" placeholder="Npr. placilo racuna" />
                  </Field>
                  <Field label="Koda namena">
                    <input value={purposeCode} onChange={(event) => setPurposeCode(event.target.value)} className="field-input" />
                  </Field>
                  <Field label="IBAN prejemnika placila" helper="BT-84; bancni racun prodajalca, kamor naj kupec placa racun.">
                    <input value={bankAccount} onChange={(event) => setBankAccount(event.target.value)} className="field-input" />
                  </Field>
                  <Field label="BIC/SWIFT" helper="BT-86; identifikator banke. Ni vedno obvezen, vendar ga dodaj, ce ga imas.">
                    <input value={bankBic} onChange={(event) => setBankBic(event.target.value)} className="field-input" />
                  </Field>
                  <Field label="Placilni pogoji" helper="BT-20; kratek tekst, npr. 'Placilo v 15 dneh'. V XML se zapise kot FTX AAB.">
                    <input value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} className="field-input" />
                  </Field>
                </div>
              </div>

              <div id="section-references">
                <details className="rounded-[1.25rem] border border-[var(--app-border)] bg-[var(--app-surface)] p-5" open={isReferenceProfile}>
                  <summary className="cursor-pointer text-xl font-semibold">Dodatna polja: reference</summary>
                  <p className="app-muted mt-2 text-sm">
                    Reference so opcijske pri standardnem racunu, pri UJP ali bancnem profilu pa prejemnik pogosto zahteva vsaj eno od njih.
                  </p>
                  <div className="mt-5">
                  <SectionHeader
                    title="Reference dokumentov"
                    description="Za UJP ali bancno posiljanje dodaj vsaj eno referenco, ce jo zahteva prejemnik."
                  />
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
                  </div>
                </details>
              </div>

              <ProfileFieldsSection
                profile={selectedProfile}
                values={currentProfileData}
                onChange={updateProfileField}
              />

              <Field label="Opomba za racun" helper="BT-22; splosna opomba racuna. V XML se zapise kot FTX GEN.">
                <textarea value={note} onChange={(event) => setNote(event.target.value)} className="field-input min-h-24 resize-none" />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div id="section-lines">
              <SectionHeader
                title="Postavke racuna"
                description="Za prvo posiljanje je dovolj naziv, kolicina, cena in DDV. Dodatna polja se prikazejo samo za izbrani profil."
                action={<button onClick={addLine} className="secondary-button h-10 px-4"><Plus className="h-4 w-4" aria-hidden="true" />Dodaj</button>}
              />

              <div className="space-y-4">
                {lines.map((line, index) => (
                  <div key={line.id} className="rounded-[1.25rem] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="status-pill">Postavka {index + 1}</span>
                      <button onClick={() => removeLine(line.id)} className="rounded-xl border border-red-500/25 px-3 py-2 text-red-500 hover:bg-red-500/10" aria-label="Odstrani postavko">
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-6">
                      <Field label="Sifra">
                        <input value={line.itemCode || ""} onChange={(event) => updateLine(line.id, { itemCode: event.target.value })} className="field-input" />
                      </Field>
                      <div className="md:col-span-2">
                        <Field label="Naziv ali opis">
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
                      {line.vatCategory !== "S" && (
                        <div className="md:col-span-2">
                          <Field label="Razlog oprostitve ali posebne DDV obravnave" helper="BT-120; obvezno pri Z, E, AE in drugih nicelnih kategorijah.">
                            <input value={line.taxExemptionReason || ""} onChange={(event) => updateLine(line.id, { taxExemptionReason: event.target.value })} className="field-input" />
                          </Field>
                        </div>
                      )}
                      <div className="md:col-span-6">
                        <details className="rounded-[1.25rem] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                          <summary className="cursor-pointer font-semibold">Dodatna polja postavke</summary>
                          <div className="mt-4">
                            <Field label="Dodatni opis">
                              <input value={line.itemDescription || line.note || ""} onChange={(event) => updateLine(line.id, { itemDescription: event.target.value })} className="field-input" />
                            </Field>
                          </div>
                        </details>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <ReviewBox title="Kupec">
                  <p className="font-semibold">{buyer.name || "-"}</p>
                  <p className="app-muted mt-1 text-sm">{buyer.vat || "Brez davcne stevilke"}</p>
                  <p className="app-muted mt-1 text-sm">{buildAddress(buyer) || "Naslov ni vnesen"}</p>
                </ReviewBox>
                <ReviewBox title="Racun">
                  <SummaryRow label="Stevilka" value={invoiceNumber} />
                  <SummaryRow label="Izdaja" value={issueDate} />
                  <SummaryRow label="Rok placila" value={dueDate} />
                </ReviewBox>
              </div>

              <ReviewBox title="Postavke">
                <div className="space-y-3">
                  {lines.map((line) => (
                    <div key={line.id} className="flex items-start justify-between gap-4 border-b border-[var(--app-border)] pb-3 last:border-b-0 last:pb-0">
                      <div>
                        <div className="font-medium">{line.description || "Brez opisa"}</div>
                        <div className="app-muted text-sm">{line.quantity} x {Number(line.price || 0).toFixed(2)} EUR · DDV {line.vatRate}%</div>
                      </div>
                      <div className="text-right font-semibold">
                        {(Number(line.quantity || 0) * Number(line.price || 0)).toFixed(2)} EUR
                      </div>
                    </div>
                  ))}
                </div>
              </ReviewBox>

              <ReviewBox title="DDV in skupaj">
                <div id="section-vat-totals" />
                <div className="grid gap-3 md:grid-cols-2">
                  {(prepared.invoice.vatBreakdown || []).map((item) => (
                    <div key={`${item.vatCategory}-${item.vatRate}`} className="rounded-2xl bg-[var(--app-soft)] p-4">
                      <div className="font-semibold">{item.vatCategory} / {item.vatRate}%</div>
                      <div className="app-muted mt-1 text-sm">Osnova {item.taxableAmount.toFixed(2)} EUR · DDV {item.vatAmount.toFixed(2)} EUR</div>
                    </div>
                  ))}
                </div>
              </ReviewBox>

              <ValidationPanel errors={prepared.validation.errors} warnings={prepared.validation.warnings} onJump={setStep} />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className={`rounded-[1.5rem] border p-5 ${
                prepared.validation.errors.length > 0
                  ? "border-red-500/25 bg-red-500/10 text-red-500"
                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
              }`}>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold">
                      {prepared.validation.errors.length > 0
                        ? "Racun potrebuje se nekaj popravkov"
                        : "Racun je pripravljen za eSLOG pripravo"}
                    </h3>
                    <p className="mt-1 text-sm opacity-90">
                      {prepared.validation.errors.length > 0
                        ? "Pred oddajo preveri napake spodaj. Racun lahko vseeno odpres v XML pregledu za diagnostiko."
                        : "V naslednjem zaslonu lahko preveris XML in ga oddas prek bizBox."}
                    </p>
                  </div>
                </div>
              </div>

              <ReviewBox title="Koncni povzetek">
                <SummaryRow label="Profil" value={selectedProfile.label} />
                <SummaryRow label="Prejemnik" value={buyer.name || "-"} />
                <SummaryRow label="Stevilka racuna" value={invoiceNumber} />
                <SummaryRow label="Za placilo" value={`${(prepared.invoice.totals.payable || prepared.invoice.totals.gross).toFixed(2)} EUR`} strong />
              </ReviewBox>

              <ValidationPanel errors={prepared.validation.errors} warnings={prepared.validation.warnings} onJump={setStep} />
            </div>
          )}

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[var(--app-border)] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <button onClick={goBack} disabled={step === 0} className="secondary-button h-12 px-5 disabled:cursor-not-allowed disabled:opacity-50">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Nazaj
            </button>
            {step < WIZARD_STEPS.length - 1 ? (
              <button onClick={goNext} className="primary-button h-12 px-6">
                Nadaljuj
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <button onClick={prepareForSending} className="primary-button h-12 px-6">
                Pripravi za posiljanje
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="glass-panel rounded-[1.75rem] p-6">
            <h2 className="text-xl font-semibold">Povzetek</h2>
            <div className="app-muted mt-1 text-sm">{selectedProfile.label}</div>
            <div className="mt-5 space-y-3 text-sm">
              <SummaryRow label="Prejemnik" value={buyer.name || "-"} />
              <SummaryRow label="Postavke" value={String(lines.length)} />
              <SummaryRow label="Neto" value={`${prepared.invoice.totals.net.toFixed(2)} EUR`} />
              <SummaryRow label="DDV" value={`${prepared.invoice.totals.vat.toFixed(2)} EUR`} />
              <SummaryRow label="Za placilo" value={`${(prepared.invoice.totals.payable || prepared.invoice.totals.gross).toFixed(2)} EUR`} strong />
            </div>
          </section>

          <section className="solid-panel rounded-[1.75rem] p-6">
            <h2 className="text-xl font-semibold">Napredek</h2>
            <div className="mt-4 space-y-3">
              {WIZARD_STEPS.map((wizardStep, index) => (
                <button
                  key={wizardStep.title}
                  onClick={() => setStep(index)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    index === step
                      ? "border-[var(--app-primary)] bg-[var(--app-soft)] text-[var(--app-primary-strong)]"
                      : "border-[var(--app-border)] hover:bg-[var(--app-soft)]"
                  }`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[var(--app-soft)] text-sm font-semibold">
                    {index + 1}
                  </span>
                  <span className="font-medium">{wizardStep.shortTitle}</span>
                </button>
              ))}
            </div>
          </section>

          {step >= 3 && (
            <section className="solid-panel rounded-[1.75rem] p-6">
              <div className="mb-4 flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-[var(--app-primary)]" aria-hidden="true" />
                <h2 className="text-xl font-semibold">Validacija</h2>
              </div>
              <p className="app-muted text-sm">
                {prepared.validation.errors.length === 0
                  ? "Ni blokirnih napak."
                  : `${prepared.validation.errors.length} napak za pregled.`}
              </p>
              {prepared.validation.warnings.length > 0 && (
                <p className="mt-2 text-sm text-amber-500">
                  {prepared.validation.warnings.length} opozoril.
                </p>
              )}
            </section>
          )}
        </aside>
      </div>
    </AppShell>
  );
}

function WizardStepper({
  currentStep,
  onStepChange,
}: {
  currentStep: number;
  onStepChange: (step: number) => void;
}) {
  return (
    <section className="solid-panel mb-8 rounded-[1.75rem] p-3">
      <div className="grid gap-2 md:grid-cols-5">
        {WIZARD_STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isDone = index < currentStep;

          return (
            <button
              key={step.title}
              onClick={() => onStepChange(index)}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                isActive
                  ? "border-[var(--app-primary)] bg-[var(--app-soft)] text-[var(--app-primary-strong)]"
                  : "border-[var(--app-border)] hover:bg-[var(--app-soft)]"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  isDone
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-[var(--app-soft)] text-[var(--app-primary)]"
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Icon className="h-4 w-4" aria-hidden="true" />
                )}
              </span>
              <span>
                <span className="block text-sm font-semibold">{step.shortTitle}</span>
                <span className="app-muted mt-0.5 hidden text-xs xl:block">
                  Korak {index + 1}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ReviewBox({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--app-border)] bg-[var(--app-surface)] p-5">
      <h3 className="mb-4 text-lg font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function BuyerField({
  label,
  field,
  buyer,
  setBuyer,
  helper,
}: {
  label: string;
  field: keyof BuyerForm;
  buyer: BuyerForm;
  setBuyer: React.Dispatch<React.SetStateAction<BuyerForm>>;
  helper?: string;
}) {
  return (
    <Field label={label} helper={helper}>
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
    <div className="rounded-[1.25rem] border border-[var(--app-border)] bg-[var(--app-surface)] p-5">
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
    </div>
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
  helper,
}: {
  label: string;
  children: React.ReactNode;
  helper?: string;
}) {
  return (
    <label className="block">
      <span className="app-muted mb-2 block text-sm font-medium">{label}</span>
      {children}
      {helper && <span className="app-muted mt-2 block text-xs leading-relaxed">{helper}</span>}
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
  onJump,
}: {
  errors: string[];
  warnings: string[];
  onJump?: (step: number) => void;
}) {
  function targetForMessage(message: string) {
    const normalized = message.toLowerCase();

    if (normalized.includes("izdajatelj") || normalized.includes("prodajalec") || normalized.includes("aktivno podjetje")) {
      return { step: 0, sectionId: "section-seller", label: "Prodajalec" };
    }

    if (normalized.includes("kupec") || normalized.includes("prejemnik")) {
      return { step: 0, sectionId: "section-buyer", label: "Kupec" };
    }

    if (
      normalized.includes("iban") ||
      normalized.includes("bic") ||
      normalized.includes("sklic") ||
      normalized.includes("plačil") ||
      normalized.includes("placil") ||
      normalized.includes("bt-81") ||
      normalized.includes("bt-83") ||
      normalized.includes("bt-84") ||
      normalized.includes("bt-86")
    ) {
      return { step: 1, sectionId: "section-payment", label: "Placilo" };
    }

    if (
      normalized.includes("referen") ||
      normalized.includes("pogod") ||
      normalized.includes("naročil") ||
      normalized.includes("narocil") ||
      normalized.includes("dobavn")
    ) {
      return { step: 1, sectionId: "section-references", label: "Reference" };
    }

    if (
      normalized.includes("datum") ||
      normalized.includes("številka") ||
      normalized.includes("stevilka") ||
      normalized.includes("tip dokumenta") ||
      normalized.includes("poslovni proces") ||
      normalized.includes("bt-23") ||
      normalized.includes("bt-24")
    ) {
      return { step: 1, sectionId: "section-invoice-details", label: "Racun" };
    }

    if (normalized.includes("postavka") || normalized.includes("ddv kategorija")) {
      return { step: 2, sectionId: "section-lines", label: "Postavke" };
    }

    if (normalized.includes("znes") || normalized.includes("breakdown") || normalized.includes("bt-110")) {
      return { step: 3, sectionId: "section-vat-totals", label: "DDV in skupaj" };
    }

    return { step: 3, sectionId: "", label: "Pregled" };
  }

  function jumpTo(message: string) {
    const target = targetForMessage(message);
    onJump?.(target.step);

    if (target.sectionId) {
      window.setTimeout(() => {
        document.getElementById(target.sectionId)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 80);
    }
  }

  function ValidationItem({ message }: { message: string }) {
    const target = targetForMessage(message);

    return (
      <li>
        <button
          type="button"
          onClick={() => jumpTo(message)}
          className="inline-flex text-left underline-offset-4 hover:underline"
        >
          {message}
          {onJump && <span className="ml-2 font-semibold">({target.label})</span>}
        </button>
      </li>
    );
  }

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
              <ValidationItem key={error} message={error} />
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="mt-4 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-500">
          <strong>Opozorila</strong>
          <ul className="mt-2 list-disc pl-5">
            {warnings.map((warning) => (
              <ValidationItem key={warning} message={warning} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
