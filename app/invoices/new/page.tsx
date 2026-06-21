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
  Search,
  Send,
  Trash2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadActiveCompanyWithFallback } from "../../../lib/client/activeCompany";
import { loadCustomersWithFallback } from "../../../lib/client/customers";
import { prependLocalDraft, saveDbDraft } from "../../../lib/client/invoiceDrafts";
import {
  checkRecipientEligibility,
  recipientStatusMeta,
} from "../../../lib/client/recipientEligibility";
import { invoiceProfiles } from "../../../lib/eslog/invoiceProfiles";
import {
  INVOICE_UNIT_OPTIONS,
  invoiceProfileDefaults,
  PAYMENT_MEANS_OPTIONS,
  PURPOSE_CODE_OPTIONS,
  VAT_CATEGORY_OPTIONS,
} from "../../../lib/invoiceCodeLists";
import {
  applyELocationSuggestion,
  suggestELocation,
  suggestVatRate,
  vatRateWarning,
} from "../../../lib/invoiceSmartDefaults";
import { normalizePartyAddress } from "../../../lib/eslog/normalizeInvoice";
import { prepareInvoiceForEslog } from "../../../lib/eslog/prepareInvoiceForEslog";
import { normalizeUnitCode, unitCodeWarning } from "../../../lib/eslog/unitCodes";
import {
  getInvoiceFieldIssues,
  getInvoiceFieldRules,
} from "../../../lib/onboarding/invoiceFieldRules";
import type { ProfileFieldDefinition } from "../../../lib/eslog/profiles/types";
import type {
  Invoice,
  InvoiceLine,
  InvoiceProfile,
  RecipientCheck,
  VatCategory,
} from "../../../types/invoice";
import AppShell from "../../components/AppShell";
import { useToast } from "../../components/ToastProvider";
import InlineFieldAssistant from "../../components/InlineFieldAssistant";
import { useInvoiceFieldAssistant } from "./useInvoiceFieldAssistant";

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
  endpointSchemeId: string;
  eAddress: string;
  registrationNumber: string;
};

type EditableLine = InvoiceLine & {
  vatCategory: VatCategory;
  vatRateManuallySet?: boolean;
};

type StoredInvoice = {
  number?: string;
};

type ProfileFieldValue = string | boolean;
type ProfileDataState = Record<InvoiceProfile, Record<string, ProfileFieldValue>>;

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
    endpointSchemeId: "",
    eAddress: "",
    registrationNumber: "",
  };
}

function customerToBuyer(customer: Customer): BuyerForm {
  const country = customer.country || taxCountry(customer.vatNumber);
  const suggestion = suggestELocation(customer.vatNumber, country);
  return {
    name: customer.name || "",
    vat: customer.vatNumber || "",
    address: customer.address || "",
    postCode: customer.postCode || "",
    city: customer.city || "",
    country,
    eLocation: customer.eLocation || "",
    endpointSchemeId: suggestion?.schemeId || "",
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
  if (["Z", "E", "AE", "K", "O", "G", "IC"].includes(line.vatCategory)) return 0;
  return round2(Number(line.quantity || 0) * Number(line.price || 0) * (Number(line.vatRate || 0) / 100));
}

export default function NewInvoicePage() {
  const toast = useToast();
  const [profile, setProfile] = useState<InvoiceProfile>("standard");
  const [profileConfirmed, setProfileConfirmed] = useState(false);
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
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerVat, setSelectedCustomerVat] = useState("");
  const [buyer, setBuyer] = useState<BuyerForm>(emptyBuyer);
  const [recipientCheck, setRecipientCheck] = useState<RecipientCheck>({
    status: "unchecked",
    message: "Prejemnik še ni preverjen",
  });
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

  const [lines, setLines] = useState<EditableLine[]>([]);

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
    const vat = params.get("vat") || params.get("customer");

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

      setInitialDataLoaded(true);
    });
  }, []);

  const selectedProfile = useMemo(
    () => invoiceProfiles.find((item) => item.id === profile) || invoiceProfiles[0],
    [profile]
  );

  const currentProfileData = profileData[profile] || {};
  const eLocationSuggestion = useMemo(
    () => suggestELocation(buyer.vat, buyer.country),
    [buyer.country, buyer.vat]
  );
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

    const invoiceLines = lines.map(({ vatRateManuallySet, ...line }) => {
      void vatRateManuallySet;
      return line;
    });

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
        endpointId: buyer.eLocation || buyer.vat,
        endpointSchemeId: buyer.endpointSchemeId || eLocationSuggestion?.schemeId,
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
      lines: invoiceLines,
      recipientCheck,
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

  function restoreInvoiceDraft(invoice: Invoice) {
    const restoredProfile = invoice.profile || "standard";
    setProfile(restoredProfile);
    setProfileConfirmed(true);
    setBuyer({
      name: invoice.buyer?.name || "",
      vat: invoice.buyer?.vat || invoice.buyer?.taxId || "",
      address: invoice.buyer?.street || invoice.buyer?.address || "",
      postCode: invoice.buyer?.postCode || "",
      city: invoice.buyer?.city || "",
      country: invoice.buyer?.country || "SI",
      eLocation: invoice.buyer?.eLocation || "",
      endpointSchemeId: invoice.buyer?.endpointSchemeId || "",
      eAddress: invoice.buyer?.eAddress || "",
      registrationNumber: invoice.buyer?.registrationNumber || "",
    });
    setSelectedCustomerVat(invoice.buyer?.vat || "");
    setRecipientCheck(
      invoice.recipientCheck || {
        status: "unchecked",
        message: "Prejemnik še ni preverjen",
      }
    );
    setInvoiceNumberNumericPart(
      invoice.invoiceNumberNumericPart || invoice.number?.split(/[-_/]/)[0] || ""
    );
    setBusinessPremiseCode(invoice.businessPremiseCode || "PP01");
    setDeviceCode(invoice.deviceCode || "01");
    setIssueDate(invoice.issueDate || today());
    setServiceDate(invoice.serviceDate || today());
    setDueDate(invoice.dueDate || addDays(15));
    setDocumentType(invoice.documentType || "380");
    setBusinessProcess(invoice.businessProcess || "P1");
    setSpecificationIdentifier(
      invoice.eSlog?.specificationIdentifier || "urn:cen.eu:en16931:2017"
    );
    setNote(invoice.note || "");
    setPaymentMeansCode(invoice.payment?.paymentMeansCode || "58");
    setPurposeCode(invoice.payment?.purposeCode || "OTHR");
    setPaymentPurpose(invoice.payment?.paymentPurpose || "");
    setBankAccount(invoice.payment?.iban || invoice.bankAccount || "");
    setBankBic(invoice.payment?.bic || invoice.bankBic || "");
    setReference(invoice.payment?.reference || invoice.reference || "");
    setPaymentTerms(invoice.payment?.paymentTerms || "");
    setSellerRegistrationNumber(invoice.seller?.registrationNumber || "");
    setOrderReference(invoice.references?.orderReference || "");
    setContractReference(invoice.references?.contractReference || "");
    setDeliveryNoteReference(invoice.references?.deliveryNoteReference || "");
    setBuyerReference(invoice.references?.buyerReference || "");
    setLines(
      (invoice.lines || []).map((line) => ({
        ...line,
        unit: normalizeUnitCode(line.unit),
        vatCategory: line.vatCategory || "S",
        vatRateManuallySet: Number.isFinite(line.vatRate),
      }))
    );
    setProfileData((current) => ({
      ...current,
      hr: { ...current.hr, ...(invoice.hrData || {}) },
      ujp: { ...current.ujp, ...(invoice.ujpData || {}) },
      bank: { ...current.bank, ...(invoice.bankData || {}) },
    }));
  }

  const draftInvoice = buildInvoice();
  const prepared = prepareInvoiceForEslog(draftInvoice);

  const fieldAssistant = useInvoiceFieldAssistant({
    profile,
    profileConfirmed,
    setProfile: changeProfile,
    setProfileConfirmed,
    setStep,
    getInvoice: buildInvoice,
    restoreInvoice: restoreInvoiceDraft,
    ready: initialDataLoaded,
  });

  function updateLine(id: number, patch: Partial<EditableLine>) {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== id) return line;

        const next = { ...line, ...patch };
        next.vatRate = suggestVatRate({
          profile,
          category: next.vatCategory,
          currentRate: next.vatRate,
          manuallyChanged: Boolean(next.vatRateManuallySet),
        });

        return next;
      })
    );
  }

  function changeProfile(nextProfile: InvoiceProfile) {
    const defaults = invoiceProfileDefaults(nextProfile);
    setProfile(nextProfile);
    if (nextProfile === "ujp") {
      setPaymentMeansCode((current) => current || defaults.paymentMeansCode);
      setPurposeCode((current) => current || defaults.purposeCode);
    }
    setLines((current) =>
      current.map((line) => {
        const vatCategory = line.vatCategory || defaults.line.vatCategory;
        return {
          ...line,
          unit: line.unit ? normalizeUnitCode(line.unit) : defaults.line.unit,
          vatCategory,
          vatRate: suggestVatRate({
            profile: nextProfile,
            category: vatCategory,
            currentRate: line.vatRate,
            manuallyChanged: Boolean(line.vatRateManuallySet),
          }),
        };
      })
    );
  }

  function addLine() {
    const defaults = invoiceProfileDefaults(profile);
    setLines((current) => [
      ...current,
      {
        id: Date.now(),
        description: "",
        quantity: 0,
        price: Number.NaN,
        vatRate: defaults.line.vatRate,
        vatRateManuallySet: false,
        unit: defaults.line.unit,
        vatCategory: defaults.line.vatCategory,
        hrVatCategoryCode: "",
        taxExemptionReason: "",
        kpdCode: "",
        kpdListId: "CG",
      },
    ]);
    fieldAssistant.onLineAdded();
  }

  function updateBuyerField(field: keyof BuyerForm, value: string) {
    setBuyer((current) => ({ ...current, [field]: value }));
    if (field === "vat" || field === "eLocation" || field === "country") {
      setRecipientCheck({ status: "unchecked", message: "Prejemnik še ni preverjen" });
    }
  }

  async function verifyRecipient() {
    setRecipientCheck({ status: "checking", message: "Preverjam prejemnika ..." });
    const result = await checkRecipientEligibility({
      vatNumber: buyer.vat,
      eLocation: buyer.eLocation,
      country: buyer.country,
    });
    setRecipientCheck(result);

    if (result.status === "enabled") {
      setBuyer((current) => ({
        ...current,
        eLocation: current.eLocation || result.eLocation || "",
        eAddress: current.eAddress || result.eAddress || "",
      }));
    }
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
    const firstIssue = getInvoiceFieldIssues(buildInvoice()).find(
      (issue) => issue.wizardStep === stepIndex
    );
    if (!firstIssue) return true;

    toast.warning("Dopolni obvezno polje", firstIssue.message);
    window.setTimeout(() => {
      const element = document.querySelector<HTMLElement>(
        `[data-field="${CSS.escape(firstIssue.fieldId)}"]`
      );
      const details = element?.closest("details");
      if (details) details.open = true;
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      const focusable = element?.matches("input, select, textarea, button")
        ? element
        : element?.querySelector<HTMLElement>("input, select, textarea, button");
      focusable?.focus();
    }, 20);
    return false;
  }

  function changeWizardStep(nextStep: number) {
    if (nextStep <= step) {
      setStep(nextStep);
      return;
    }

    const blockingIssue = getInvoiceFieldIssues(buildInvoice()).find(
      (issue) => issue.wizardStep < nextStep
    );
    if (blockingIssue) {
      setStep(blockingIssue.wizardStep);
      toast.warning("Dopolni obvezno polje", blockingIssue.message);
      return;
    }

    setStep(nextStep);
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
    window.location.assign("/invoices/xml");
  }

  const isReferenceProfile = profile === "ujp" || profile === "bank";
  const currentStep = WIZARD_STEPS[step];
  const CurrentStepIcon = currentStep.icon;
  const currentStepRules = getInvoiceFieldRules(draftInvoice).filter(
    (rule) => rule.target.wizardStep === step
  );
  const completedStepRules = currentStepRules.filter(
    (rule) => rule.validate(draftInvoice) === null
  ).length;
  const completedRuleRatio = currentStepRules.length
    ? completedStepRules / currentStepRules.length
    : 1;
  const progress = Math.min(
    100,
    Math.round((step * 20 + completedRuleRatio * 20) / 5) * 5
  );

  return (
    <AppShell>
      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between" data-tour="invoice-header">
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

      <WizardStepper
        currentStep={step}
        progress={progress}
        onStepChange={changeWizardStep}
      />

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
              <div id="section-profile" data-tour="invoice-profile" data-field="profile.selection">
                <SectionHeader
                  title="Vrsta racuna"
                  description="Izberi najblizji nacin posiljanja. Podatki, ki so posebni za profil, se prikazejo kasneje."
                />
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {invoiceProfiles.map((invoiceProfile) => (
                    <button
                      key={invoiceProfile.id}
                      onClick={() => {
                        changeProfile(invoiceProfile.id);
                        setProfileConfirmed(true);
                      }}
                      data-tour={`profile-${invoiceProfile.id}`}
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

              <div id="section-buyer" data-tour="invoice-buyer">
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
                    setRecipientCheck(
                      selected?.status === "READY"
                        ? {
                            status: "enabled",
                            identifier: selected.vatNumber,
                            message: "Prejemnik sprejema eRačune",
                            checkedAt: new Date().toISOString(),
                            eLocation: selected.eLocation,
                            eAddress: selected.eAddress,
                          }
                        : { status: "unchecked", message: "Prejemnik še ni preverjen" }
                    );
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
                  <BuyerField label="Davcna stevilka / OIB" field="vat" buyer={buyer} setBuyer={setBuyer} onChange={updateBuyerField} />
                  <BuyerField label="Naslov" field="address" buyer={buyer} setBuyer={setBuyer} />
                  <BuyerField label="Postna stevilka" field="postCode" buyer={buyer} setBuyer={setBuyer} />
                  <BuyerField label="Mesto" field="city" buyer={buyer} setBuyer={setBuyer} />
                  <BuyerField label="Drzava" field="country" buyer={buyer} setBuyer={setBuyer} onChange={updateBuyerField} />
                  <BuyerField label="eLokacija" field="eLocation" buyer={buyer} setBuyer={setBuyer} onChange={updateBuyerField} helper="Identifikator prejemnika v eSLOG/bizBox omrezju. Ce ga ne poznas, ga navadno vrne iskanje stranke." />
                </div>
                {eLocationSuggestion && (
                  <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-soft)] p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium">Predlagana e-lokacija glede na davčno številko.</div>
                      <div className="app-muted mt-1">{eLocationSuggestion.schemeId}:{eLocationSuggestion.value}</div>
                    </div>
                    {buyer.eLocation !== eLocationSuggestion.value && (
                      <button
                        type="button"
                        className="secondary-button h-10 px-4"
                        onClick={() => {
                          setBuyer((current) => ({
                            ...current,
                            eLocation: applyELocationSuggestion(current.eLocation, eLocationSuggestion, true),
                            endpointSchemeId: eLocationSuggestion.schemeId,
                          }));
                          setRecipientCheck({ status: "unchecked", message: "Prejemnik še ni preverjen" });
                        }}
                      >
                        Uporabi predlog
                      </button>
                    )}
                  </div>
                )}
                <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[var(--app-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <RecipientStatus check={recipientCheck} />
                  <button
                    type="button"
                    onClick={verifyRecipient}
                    disabled={recipientCheck.status === "checking" || (!buyer.vat.trim() && !buyer.eLocation.trim())}
                    className="secondary-button h-10 px-4 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Search className="h-4 w-4" aria-hidden="true" />
                    {recipientCheck.status === "checking" ? "Preverjam ..." : "Preveri prejemnika"}
                  </button>
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

              <div id="section-seller" data-field="seller.settings">
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
                  <Field label="Zaporedna stevilka" fieldId="invoice.number">
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
                  <Field label="Datum izdaje" fieldId="invoice.issueDate">
                    <input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} className="field-input" />
                  </Field>
                  <Field label="Datum storitve" fieldId="invoice.serviceDate">
                    <input type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} className="field-input" />
                  </Field>
                  <Field label="Rok placila" fieldId="invoice.dueDate">
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
                  <Field label="Nacin placila" fieldId="payment.paymentMeansCode" helper={`V XML se zapiše kot ${paymentMeansCode}.`}>
                    <select value={paymentMeansCode} onChange={(event) => setPaymentMeansCode(event.target.value)} className="field-input">
                      {PAYMENT_MEANS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Sklic placila" fieldId="payment.reference" helper="BT-83; remittance information/sklic, ki poveze placilo z racunom. V XML se mapira kot RFF PQ.">
                    <input value={reference} onChange={(event) => setReference(event.target.value)} className="field-input" />
                  </Field>
                  <Field label="Namen placila" fieldId="payment.paymentPurpose" helper="Opis namena plačila; pri profilu Banka je obvezen in se zapiše v FTX PMT.">
                    <input value={paymentPurpose} onChange={(event) => setPaymentPurpose(event.target.value)} className="field-input" placeholder="Npr. placilo racuna" />
                  </Field>
                  <Field label="Koda namena" fieldId="payment.purposeCode" helper={`V XML se zapiše kot ${purposeCode}.`}>
                    <select value={purposeCode} onChange={(event) => setPurposeCode(event.target.value)} className="field-input">
                      {PURPOSE_CODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.value} – {option.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="IBAN prejemnika placila" fieldId="payment.iban" helper="BT-84; bancni racun prodajalca, kamor naj kupec placa racun.">
                    <input value={bankAccount} onChange={(event) => setBankAccount(event.target.value)} className="field-input" />
                  </Field>
                  <Field label="BIC/SWIFT" fieldId="payment.bic" helper="BT-86; identifikator banke. Ni vedno obvezen, vendar ga dodaj, ce ga imas.">
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
                  <div className="mt-5" data-field="references.document">
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
            <div id="section-lines" data-field="invoice.lines">
              <SectionHeader
                title="Postavke racuna"
                description="Za prvo posiljanje je dovolj naziv, kolicina, cena in DDV. Dodatna polja se prikazejo samo za izbrani profil."
                action={<button onClick={addLine} className="secondary-button h-10 px-4" data-field="invoice.lines.add"><Plus className="h-4 w-4" aria-hidden="true" />Dodaj postavko</button>}
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
                        <Field label="Naziv ali opis" fieldId={`lines.${line.id}.description`}>
                          <input value={line.description} onChange={(event) => updateLine(line.id, { description: event.target.value })} className="field-input" />
                        </Field>
                      </div>
                      <Field label="Kolicina" fieldId={`lines.${line.id}.quantity`}>
                        <input type="number" value={line.quantity > 0 ? line.quantity : ""} onChange={(event) => updateLine(line.id, { quantity: Number(event.target.value) })} className="field-input" />
                      </Field>
                      <Field label="Enota" fieldId={`lines.${line.id}.unit`} helper={line.unit ? `V XML se zapiše kot ${normalizeUnitCode(line.unit)}.` : undefined}>
                        <select value={normalizeUnitCode(line.unit)} onChange={(event) => updateLine(line.id, { unit: event.target.value })} className="field-input">
                          {INVOICE_UNIT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        {unitCodeWarning(line.unit) && (
                          <span className="mt-2 block text-xs text-amber-600">{unitCodeWarning(line.unit)}</span>
                        )}
                      </Field>
                      <Field label="Neto cena" fieldId={`lines.${line.id}.price`}>
                        <input type="number" value={Number.isFinite(line.price) ? line.price : ""} onChange={(event) => updateLine(line.id, { price: event.target.value === "" ? Number.NaN : Number(event.target.value) })} className="field-input" />
                      </Field>
                      <Field label="DDV kategorija" fieldId={`lines.${line.id}.vatCategory`}>
                        <select value={line.vatCategory} onChange={(event) => updateLine(line.id, { vatCategory: event.target.value as VatCategory })} className="field-input">
                          <option value="" disabled>Izberi DDV kategorijo</option>
                          {VAT_CATEGORY_OPTIONS.map((category) => (
                            <option key={category.value} value={category.value}>{category.value} – {category.label}</option>
                          ))}
                        </select>
                        {line.vatCategory && (
                          <span className="app-muted mt-2 block text-xs">V XML se zapiše kot {line.vatCategory}.</span>
                        )}
                      </Field>
                      <Field label="DDV %" fieldId={`lines.${line.id}.vatRate`}>
                        <input
                          type="number"
                          value={Number.isFinite(line.vatRate) ? line.vatRate : ""}
                          onChange={(event) =>
                            updateLine(line.id, {
                              vatRate: event.target.value === "" ? Number.NaN : Number(event.target.value),
                              vatRateManuallySet: event.target.value !== "",
                            })
                          }
                          className="field-input"
                        />
                        {vatRateWarning(profile, line.vatCategory, line.vatRate) && (
                          <span className="mt-2 block text-xs text-amber-600">
                            {vatRateWarning(profile, line.vatCategory, line.vatRate)}
                          </span>
                        )}
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
                          <Field label="Razlog oprostitve ali posebne DDV obravnave" fieldId={`lines.${line.id}.taxExemptionReason`} helper="BT-120; obvezno pri Z, E, AE in drugih nicelnih kategorijah.">
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
            <div className="space-y-6" data-field="invoice.review">
              <div className="grid gap-4 md:grid-cols-2">
                <ReviewBox title="Kupec">
                  <p className="font-semibold">{buyer.name || "-"}</p>
                  <p className="app-muted mt-1 text-sm">{buyer.vat || "Brez davcne stevilke"}</p>
                  <p className="app-muted mt-1 text-sm">{buildAddress(buyer) || "Naslov ni vnesen"}</p>
                  <div className="mt-3"><RecipientStatus check={recipientCheck} /></div>
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
              <button onClick={goNext} className="primary-button h-12 px-6" data-tour="invoice-next">
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
          <InvoiceCoachCard
            step={step}
            profile={profile}
            profileConfirmed={profileConfirmed}
            lines={lines}
            validationErrorCount={prepared.validation.errors.length}
          />

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
      <InlineFieldAssistant
        state={fieldAssistant.state}
        onNext={fieldAssistant.next}
        onClose={fieldAssistant.close}
      />
    </AppShell>
  );
}

function WizardStepper({
  currentStep,
  progress,
  onStepChange,
}: {
  currentStep: number;
  progress: number;
  onStepChange: (step: number) => void;
}) {
  const connectorProgress = Math.max(0, Math.min(100, ((progress - 20) / 80) * 100));

  return (
    <section className="solid-panel sticky top-[7.25rem] z-40 mb-8 rounded-[1.4rem] px-3 py-3 sm:rounded-[1.75rem] sm:px-6 sm:py-5 lg:top-4" data-tour="invoice-stepper">
      <div className="mb-3 flex items-end justify-between gap-4 sm:mb-5">
        <div>
          <p className="text-sm font-semibold text-[var(--app-primary)]">Od kreiranja do pošiljanja</p>
          <p className="app-muted mt-1 hidden text-sm sm:block">Napredek se dopolnjuje, ko so obvezni podatki pravilni.</p>
        </div>
        <div className="text-right">
          <span className="text-xl font-semibold tabular-nums sm:text-2xl">{progress}%</span>
          <span className="app-muted hidden text-xs sm:block">opravljeno</span>
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-[10%] right-[10%] top-4 h-0.5 overflow-hidden rounded-full bg-[var(--app-border)] sm:top-5" aria-hidden="true">
          <div
            className="h-full rounded-full bg-[var(--app-primary)] transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${connectorProgress}%` }}
          />
        </div>
        <div className="relative grid grid-cols-5 gap-1 sm:gap-2">
        {WIZARD_STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isDone = index < currentStep;

          return (
            <button
              key={step.title}
              onClick={() => onStepChange(index)}
              className="group flex min-w-0 flex-col items-center gap-2 rounded-xl px-1 py-0.5 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-primary)]"
              aria-current={isActive ? "step" : undefined}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-[var(--app-surface)] transition-colors sm:h-10 sm:w-10 ${
                  isDone
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : isActive
                      ? "border-[var(--app-primary)] text-[var(--app-primary)] shadow-[0_0_0_5px_var(--app-soft)]"
                      : "border-[var(--app-border)] text-[var(--app-muted)] group-hover:border-[var(--app-primary)]"
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Icon className="h-4 w-4" aria-hidden="true" />
                )}
              </span>
              <span className={`truncate text-xs font-semibold sm:text-sm ${isActive ? "text-[var(--app-primary-strong)]" : ""}`}>
                {index === 0
                  ? "Kreiranje"
                  : index === 4
                    ? "Pošiljanje"
                    : step.shortTitle}
              </span>
            </button>
          );
        })}
        </div>
      </div>
    </section>
  );
}

type CoachTip = {
  text: string;
  done?: boolean;
};

function InvoiceCoachCard({
  step,
  profile,
  profileConfirmed,
  lines,
  validationErrorCount,
}: {
  step: number;
  profile: InvoiceProfile;
  profileConfirmed: boolean;
  lines: EditableLine[];
  validationErrorCount: number;
}) {
  let title = "Izberi pravega prejemnika";
  let description = "Začni s kupcem in profilom računa. Profil določi, katere podatke bo treba izpolniti.";
  let tips: CoachTip[] = [
    { text: "Izberi profil glede na način prejemanja računa.", done: profileConfirmed },
    { text: "Izberi shranjenega kupca ali skrbno vnesi njegove podatke." },
    { text: "Preveri davčno številko, naslov in elektronsko lokacijo." },
  ];

  if (step === 1) {
    title = "Uredi podatke računa";
    description = "Preveri številko, datume in način plačila. Tako bo račun razumljiv tudi prejemniku.";
    tips = [
      { text: "Preveri številko računa in datum izdaje." },
      { text: "Nastavi datum storitve in rok plačila." },
      { text: "Preveri IBAN, namen plačila in plačilni sklic." },
    ];
    if (profile === "ujp" || profile === "bank") {
      tips.push({ text: "Vnesi vsaj eno dokumentno referenco: naročilo, pogodbo ali dobavnico." });
    }
    if (profile === "hr") {
      tips.push({ text: "Preveri čas izdaje, poslovni proces in OIB operaterja." });
    }
  } else if (step === 2) {
    const hasLines = lines.length > 0;
    title = "Dodaj, kar zaračunavaš";
    description = "Postavke so jedro računa: povedo, kaj in koliko zaračunavaš. Zneski in DDV se izračunajo sproti.";
    tips = [
      { text: "Dodaj prvo postavko", done: hasLines },
      { text: "Vnesi opis storitve/blaga", done: hasLines && lines.every((line) => line.description.trim().length > 0) },
      { text: "Vnesi količino", done: hasLines && lines.every((line) => Number(line.quantity) > 0) },
      { text: "Preveri enoto mere", done: hasLines && lines.every((line) => Boolean(line.unit?.trim())) },
      { text: "Vnesi ceno", done: hasLines && lines.every((line) => Number.isFinite(Number(line.price)) && Number(line.price) >= 0) },
      { text: "Izberi DDV stopnjo", done: hasLines && lines.every((line) => Boolean(line.vatCategory) && Number.isFinite(Number(line.vatRate))) },
      { text: "Neto znesek in DDV se izračunata samodejno.", done: hasLines },
    ];
    if (profile === "hr") {
      tips.push(
        {
          text: "Izberi KPD/CPA klasifikacijo za vsako postavko.",
          done: hasLines && lines.every((line) => Boolean(line.kpdCode?.trim())),
        },
        {
          text: "Izberi HR DDV kategorijo, ki ustreza postavki.",
          done: hasLines && lines.every((line) => Boolean(line.hrVatCategoryCode?.trim())),
        }
      );
    }
  } else if (step === 3) {
    title = "Mirno preveri povzetek";
    description = "Pred pripravo XML-ja še enkrat preglej prejemnika, postavke in končni znesek.";
    tips = [
      { text: "Primerjaj neto znesek, DDV in znesek za plačilo." },
      { text: "Odpravi označene napake pred nadaljevanjem.", done: validationErrorCount === 0 },
      { text: "Ko je vse pravilno, nadaljuj na pripravo eSLOG XML-ja." },
    ];
  } else if (step === 4) {
    title = "Pripravljeno za pošiljanje";
    description = "Račun bo poslan prek bizBox. Po oddaji boš videl potrditev in njegovo nadaljnje stanje.";
    tips = [
      { text: "Še zadnjič preveri prejemnika in znesek." },
      { text: "Pripravi račun za eSLOG pregled in oddajo prek bizBox." },
      { text: "Po uspešni oddaji bo račun označen kot poslan." },
    ];
  }

  return (
    <section className="rounded-[1.75rem] border border-[var(--app-primary)]/25 bg-[var(--app-soft)] p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--app-surface)] text-[var(--app-primary)] shadow-sm">
          <ListChecks className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--app-primary)]">Pomočnik</p>
          <h2 className="font-semibold">{title}</h2>
        </div>
      </div>
      <p className="app-muted text-sm leading-6">{description}</p>
      <ul className="mt-5 space-y-3">
        {tips.map((tip) => (
          <li key={tip.text} className="flex gap-3 text-sm leading-5">
            {tip.done ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
            ) : (
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--app-primary)]" aria-hidden="true" />
            )}
            <span className={tip.done ? "text-[var(--app-muted)] line-through decoration-emerald-500/50" : ""}>
              {tip.text}
            </span>
          </li>
        ))}
      </ul>
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
  onChange,
  helper,
}: {
  label: string;
  field: keyof BuyerForm;
  buyer: BuyerForm;
  setBuyer: React.Dispatch<React.SetStateAction<BuyerForm>>;
  onChange?: (field: keyof BuyerForm, value: string) => void;
  helper?: string;
}) {
  return (
    <Field label={label} helper={helper} fieldId={`buyer.${field}`}>
      <input
        value={buyer[field]}
        onChange={(event) => {
          if (onChange) onChange(field, event.target.value);
          else setBuyer((current) => ({ ...current, [field]: event.target.value }));
        }}
        className="field-input"
      />
    </Field>
  );
}

function RecipientStatus({ check }: { check: RecipientCheck }) {
  const meta = recipientStatusMeta(check.status);
  return (
    <div className={`text-sm font-medium ${meta.className}`} data-testid="recipient-check-status">
      {meta.icon && <span className="mr-2" aria-hidden="true">{meta.icon}</span>}
      {check.message}
    </div>
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
            fieldId={`profile.${profile.id}.${field.name}`}
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
    <ProfileField
      field={field}
      fieldId={`lines.${line.id}.${field.name}`}
      value={value}
      onChange={onChange}
    />
  );
}

function ProfileField({
  field,
  fieldId,
  value,
  onChange,
}: {
  field: ProfileFieldDefinition;
  fieldId: string;
  value: ProfileFieldValue | undefined;
  onChange: (value: ProfileFieldValue) => void;
}) {
  const label = `${field.label}${field.required ? " *" : ""}`;
  const wrapperClass = field.span === "full" ? "md:col-span-2" : "";

  if (field.type === "checkbox") {
    return (
      <label data-field={fieldId} className={`flex items-start gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 ${wrapperClass}`}>
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
      <Field label={label} fieldId={fieldId}>
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
  fieldId,
}: {
  label: string;
  children: React.ReactNode;
  helper?: string;
  fieldId?: string;
}) {
  return (
    <label className="block rounded-2xl" data-field={fieldId}>
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
