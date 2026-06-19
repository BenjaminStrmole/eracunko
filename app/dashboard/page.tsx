"use client";

import {
  AlertCircle,
  ArrowRight,
  ChevronRight,
  FileCheck2,
  FileClock,
  Inbox,
  PlusCircle,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "../components/AppShell";
import CompanySelector from "../components/CompanySelector";
import { loadActiveCompanyWithFallback } from "../../lib/client/activeCompany";
import { getInboxData, getSentData } from "../../lib/client/bizboxDataCache";
import { fetchDbCustomers, type ClientCustomer } from "../../lib/client/customers";

type RawParam = {
  parameterName?: string;
  parameterValue?: string;
};

type RawDocument = {
  parameters?: {
    param?: RawParam[];
  };
  classificationname?: string;
  classificationName?: string;
  title?: string;
  type?: string;
};

type DocumentItem = {
  id: string;
  number: string;
  sender: string;
  type: string;
  status: string;
  date: string;
  raw?: RawDocument;
  metadata?: RawDocument;
  parameters?: {
    param?: RawParam[];
  };
  acknowledgement?: {
    confirmationType?: string;
    description?: string;
    roleType?: string;
    isError?: boolean;
  };
};

type ActiveCompany = {
  name?: string;
  vatNumber?: string;
  taxId?: string;
  eLocation?: string;
  eAddress?: string;
};

type LocalInvoice = {
  number?: string;
  id?: string;
  docId?: string;
  receiver?: string;
  amount?: string;
  date?: string;
  buyer?: {
    name?: string;
  };
  seller?: {
    vat?: string;
    taxId?: string;
  };
  totals?: {
    net?: number;
    vat?: number;
    gross?: number;
    payable?: number;
  };
  createdAt?: string;
  sentAt?: string;
  status?: string;
};

type DashboardStats = {
  receivedCount: number;
  sentCount: number;
  acknowledgementCount: number;
  failedAcknowledgementCount: number;
  pendingSentCount: number;
  draftCount: number;
  customerCount: number;
  sentTotal: number;
  draftTotal: number;
};

type DashboardRemoteCache = {
  documents: DocumentItem[];
  remoteSentInvoices: LocalInvoice[];
  timestamp: number;
};

const DASHBOARD_CACHE_TTL_MS = 60_000;
const dashboardCache = new Map<string, DashboardRemoteCache>();

function isAbortError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.name === "AbortError" || error.message.toLowerCase().includes("abort");
}

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function isInCurrentMonth(value?: string) {
  if (!value) return false;
  const slovenianDate = value.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  const date = slovenianDate
    ? new Date(Number(slovenianDate[3]), Number(slovenianDate[2]) - 1, Number(slovenianDate[1]))
    : new Date(value);
  const today = new Date();

  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth()
  );
}

function getParam(item: DocumentItem, name: string) {
  const params =
    item.metadata?.parameters?.param ||
    item.raw?.parameters?.param ||
    item.parameters?.param ||
    [];
  const found = params.find((param) => param.parameterName === name);
  return found?.parameterValue || "";
}

function isAcknowledgement(item: DocumentItem) {
  const actualType = getParam(item, "ACTUAL_TYPE");
  const roleType = item.acknowledgement?.roleType || getParam(item, "DOC_ROLE_TYPE");
  const classification =
    item.metadata?.classificationname ||
    item.metadata?.classificationName ||
    item.raw?.classificationname ||
    item.raw?.classificationName ||
    "";

  return (
    item.type === "Povratnica" ||
    item.metadata?.type === "Povratnica" ||
    actualType === "IFTMAN" ||
    roleType.toLowerCase().includes("povratnica") ||
    classification.toLowerCase().includes("iftman")
  );
}

function documentSearchText(item: DocumentItem) {
  return [
    item.number,
    item.type,
    item.status,
    item.raw?.title,
    item.raw?.type,
    item.metadata?.title,
    item.metadata?.type,
    item.acknowledgement?.confirmationType,
    item.acknowledgement?.description,
    item.acknowledgement?.roleType,
    getParam(item, "VrstaPotrditve"),
    getParam(item, "Opis"),
    getParam(item, "DOC_ROLE_TYPE"),
    getParam(item, "Status"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isFailedAcknowledgement(item: DocumentItem) {
  if (item.acknowledgement?.isError) return true;

  const confirmation = String(
    item.acknowledgement?.confirmationType || getParam(item, "VrstaPotrditve") || ""
  ).toLowerCase();
  const text = documentSearchText(item);

  return (
    confirmation.startsWith("27") ||
    confirmation.includes("-99") ||
    text.includes("-99") ||
    text.includes("zavrnj") ||
    text.includes("reject") ||
    text.includes("failed") ||
    text.includes("failure") ||
    text.includes("error") ||
    text.includes("napaka") ||
    text.includes("neuspe") ||
    text.includes("ni usp") ||
    text.includes("nedostav") ||
    (text.includes("dostav") && text.includes("napak")) ||
    (text.includes("fiskal") && text.includes("napak")) ||
    (text.includes("fiscal") && (text.includes("fail") || text.includes("error"))) ||
    (text.includes("report") && (text.includes("fail") || text.includes("error"))) ||
    (text.includes("poroč") && text.includes("napak"))
  );
}

function isErrorAck(item: DocumentItem) {
  return isFailedAcknowledgement(item);
}

function normalizeTaxId(value?: string | null) {
  return String(value || "").replace(/\s/g, "").toUpperCase();
}

function invoiceMatchesActiveCompany(
  invoice: LocalInvoice,
  activeCompany: ActiveCompany | null
) {
  if (!activeCompany) return false;

  const companyTaxId = normalizeTaxId(activeCompany.vatNumber || activeCompany.taxId);
  const invoiceTaxId = normalizeTaxId(invoice.seller?.vat || invoice.seller?.taxId);

  if (!invoiceTaxId) return true;
  return invoiceTaxId === companyTaxId;
}

function mergeUniqueInvoices(
  localInvoices: LocalInvoice[],
  remoteInvoices: LocalInvoice[]
) {
  return [...localInvoices, ...remoteInvoices].filter((invoice, index, array) => {
    const key = invoice.id || invoice.docId || invoice.number;
    return array.findIndex((item) => (item.id || item.docId || item.number) === key) === index;
  });
}

function dashboardCacheKey(activeCompany: ActiveCompany | null) {
  return normalizeTaxId(activeCompany?.vatNumber || activeCompany?.taxId) || "no-company";
}

function getFreshDashboardCache(key: string) {
  const cached = dashboardCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > DASHBOARD_CACHE_TTL_MS) {
    dashboardCache.delete(key);
    return null;
  }

  return cached;
}

export function countFailedAcknowledgements(acknowledgements: DocumentItem[]) {
  return acknowledgements.filter(isFailedAcknowledgement).length;
}

export function countPendingSentInvoices(invoices: LocalInvoice[]) {
  return invoices.filter((invoice) => {
    const text = String(invoice.status || "").toLowerCase();
    return (
      text.includes("pending") ||
      text.includes("čaka") ||
      text.includes("caka") ||
      text.includes("v obdelavi") ||
      text.includes("processing") ||
      text.includes("poslano") ||
      text.includes("sent")
    );
  }).length;
}

export function getDashboardStats({
  documents,
  sentInvoices,
  draftInvoices,
  customerCount,
}: {
  documents: DocumentItem[];
  sentInvoices: LocalInvoice[];
  draftInvoices: LocalInvoice[];
  customerCount: number;
}): DashboardStats {
  const receivedInvoices = documents.filter((doc) => !isAcknowledgement(doc));
  const acknowledgements = documents.filter(isAcknowledgement);
  const sentTotal = sentInvoices.reduce(
    (sum, invoice) => sum + (invoice.totals?.gross || invoice.totals?.payable || 0),
    0
  );
  const draftTotal = draftInvoices.reduce(
    (sum, invoice) => sum + (invoice.totals?.gross || invoice.totals?.payable || 0),
    0
  );

  return {
    receivedCount: receivedInvoices.length,
    sentCount: sentInvoices.length,
    acknowledgementCount: acknowledgements.length,
    failedAcknowledgementCount: countFailedAcknowledgements(acknowledgements),
    pendingSentCount: countPendingSentInvoices(sentInvoices),
    draftCount: draftInvoices.length,
    customerCount,
    sentTotal,
    draftTotal,
  };
}

export default function DashboardPage() {
  const loadIdRef = useRef(0);
  const [ackFilter, setAckFilter] = useState<"all" | "success" | "error" | "pending">("all");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeCompany, setActiveCompany] = useState<ActiveCompany | null>(null);
  const [sentInvoices, setSentInvoices] = useState<LocalInvoice[]>([]);
  const [draftInvoices, setDraftInvoices] = useState<LocalInvoice[]>([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [favoriteCustomers, setFavoriteCustomers] = useState<ClientCustomer[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [sentLoading, setSentLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadDashboard(options: { force?: boolean } = {}) {
    const loadId = ++loadIdRef.current;
    const force = options.force || false;
    setRefreshing(force);
    const company = (await loadActiveCompanyWithFallback()) as ActiveCompany | null;
    if (loadId !== loadIdRef.current) return;

    const localSent = safeJsonParse<LocalInvoice[]>(localStorage.getItem("sent"), []);
    const localDrafts = safeJsonParse<LocalInvoice[]>(
      localStorage.getItem("drafts"),
      []
    );
    const localCustomers = safeJsonParse<unknown[]>(
      localStorage.getItem("customers"),
      []
    );
    const dbCustomers = await fetchDbCustomers().catch(() => []);

    const companySent = localSent.filter((invoice) =>
      invoiceMatchesActiveCompany(invoice, company)
    );
    const companyDrafts = localDrafts.filter((invoice) =>
      invoiceMatchesActiveCompany(invoice, company)
    );

    setActiveCompany(company);
    setSentInvoices(companySent);
    setDraftInvoices(companyDrafts);
    const allCustomers = dbCustomers.length > 0 ? dbCustomers : (localCustomers as ClientCustomer[]);
    setCustomerCount(allCustomers.length);
    setFavoriteCustomers(allCustomers.filter((customer) => customer.isFavorite).slice(0, 6));
    setStatsLoading(false);

    const cacheKey = dashboardCacheKey(company);
    const cached = getFreshDashboardCache(cacheKey);

    if (cached) {
      setDocuments(cached.documents);
      setSentInvoices(mergeUniqueInvoices(companySent, cached.remoteSentInvoices));
      setDocumentsLoading(false);
      setSentLoading(false);
      setStatsLoading(false);
    } else {
      setDocuments([]);
      setDocumentsLoading(true);
      setSentLoading(true);
    }

    const taxNumber = company?.vatNumber || company?.taxId || "";
    let nextDocuments: DocumentItem[] = [];
    let nextRemoteSentInvoices: LocalInvoice[] = [];
    let documentsLoaded = false;
    let sentLoaded = false;

    setDocumentsLoading(true);
    setSentLoading(true);
    setStatsLoading(true);

    const applyInboxData = (inboxData: {
      success: boolean;
      documents?: DocumentItem[];
    }) => {
      if (loadId !== loadIdRef.current) return;

      if (inboxData.success) {
        nextDocuments = inboxData.documents || [];
        documentsLoaded = true;
        setDocuments(nextDocuments);
      } else {
        nextDocuments = [];
        if (!cached) setDocuments([]);
      }
    };

    const applySentData = (sentData: {
      success: boolean;
      documents?: LocalInvoice[];
    }) => {
      if (loadId !== loadIdRef.current) return;

      if (sentData.success) {
        nextRemoteSentInvoices = sentData.documents || [];
        sentLoaded = true;
        setSentInvoices(mergeUniqueInvoices(companySent, nextRemoteSentInvoices));
      } else {
        nextRemoteSentInvoices = [];
        setSentInvoices(companySent);
      }
    };

    const inboxPromise = getInboxData<DocumentItem>({
      taxNumber,
      includeMetadata: true,
      limit: 300,
      timeoutMs: 90_000,
    })
      .then((result) => {
        applyInboxData(result.data);

        if (result.fromCache && result.refresh) {
          result.refresh
            .then((freshData) => {
              if (freshData) applyInboxData(freshData);
            })
            .catch(() => {});
        }
      })
      .catch((error) => {
        if (isAbortError(error)) return;
        if (loadId !== loadIdRef.current) return;
        nextDocuments = [];
        if (!cached) setDocuments([]);
      })
      .finally(() => {
        if (loadId === loadIdRef.current) {
          setDocumentsLoading(false);
        }
      });

    const sentPromise = getSentData<LocalInvoice>({
      taxNumber,
      limit: 150,
      timeoutMs: 90_000,
    })
      .then((result) => {
        applySentData(result.data);

        if (result.fromCache && result.refresh) {
          result.refresh
            .then((freshData) => {
              if (freshData) applySentData(freshData);
            })
            .catch(() => {});
        }
      })
      .catch((error) => {
        if (isAbortError(error)) return;
        if (loadId !== loadIdRef.current) return;
        nextRemoteSentInvoices = [];
        setSentInvoices(companySent);
      })
      .finally(() => {
        if (loadId === loadIdRef.current) {
          setSentLoading(false);
        }
      });

    await Promise.all([inboxPromise, sentPromise]);
    if (loadId !== loadIdRef.current) return;

    if (documentsLoaded && sentLoaded) {
      dashboardCache.set(cacheKey, {
        documents: nextDocuments,
        remoteSentInvoices: nextRemoteSentInvoices,
        timestamp: Date.now(),
      });
    }
    setStatsLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    queueMicrotask(() => {
      loadDashboard();
    });

    const handleActiveCompanyChanged = () => loadDashboard({ force: true });

    window.addEventListener("active-company-changed", handleActiveCompanyChanged);

    return () => {
      window.removeEventListener("active-company-changed", handleActiveCompanyChanged);
    };
  }, []);

  const receivedInvoices = useMemo(
    () => documents.filter((doc) => !isAcknowledgement(doc)),
    [documents]
  );

  const acknowledgements = useMemo(
    () => documents.filter(isAcknowledgement),
    [documents]
  );

  const latestAcks = acknowledgements.slice(0, 5);
  const latestReceived = receivedInvoices.slice(0, 5);
  const stats = useMemo(
    () =>
      getDashboardStats({
        documents,
        sentInvoices,
        draftInvoices,
        customerCount,
      }),
    [customerCount, documents, draftInvoices, sentInvoices]
  );
  const latestSent = sentInvoices.slice(-5).reverse();
  const monthlyReceivedCount = useMemo(
    () => receivedInvoices.filter((invoice) => isInCurrentMonth(invoice.date)).length,
    [receivedInvoices]
  );
  const monthlySentCount = useMemo(
    () =>
      sentInvoices.filter((invoice) =>
        isInCurrentMonth(invoice.sentAt || invoice.date || invoice.createdAt)
      ).length,
    [sentInvoices]
  );
  const filteredAcks = useMemo(() => {
    if (ackFilter === "error") return acknowledgements.filter(isErrorAck);
    if (ackFilter === "success") return acknowledgements.filter((doc) => !isErrorAck(doc));
    if (ackFilter === "pending") {
      return acknowledgements.filter((doc) => {
        const text = `${doc.status} ${getParam(doc, "VrstaPotrditve")} ${getParam(doc, "Opis")}`.toLowerCase();
        return text.includes("čaka") || text.includes("caka") || text.includes("obdelavi") || text.includes("pending");
      });
    }

    return acknowledgements;
  }, [ackFilter, acknowledgements]);
  const displayedAcks = filteredAcks.slice(0, 5);
  const activityLoading = documentsLoading || sentLoading;

  return (
    <AppShell>
      <div className="mb-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--app-primary-strong)] shadow-sm">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Pošlji račun v 30 sekundah
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.035em] md:text-5xl">
            Kaj želiš narediti danes?
          </h1>
          <p className="app-muted mt-4 max-w-2xl text-base leading-7">
            Izberi nalogo in eRačunko te bo vodil brez tehničnega balasta.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <CompanySelector />
          <button
            onClick={() => loadDashboard({ force: true })}
            disabled={refreshing}
            className="secondary-button h-12 px-5 text-sm disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Osveži
          </button>
        </div>
      </div>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
        <Link
          href="/invoices/new"
          className="group relative min-h-[340px] overflow-hidden rounded-[2.25rem] bg-[linear-gradient(145deg,#075fb8_0%,#0a84ff_58%,#65b8ff_100%)] p-8 text-white shadow-[0_28px_80px_rgba(10,132,255,0.28)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 md:p-10"
        >
          <span className="absolute -right-20 -top-24 h-64 w-64 rounded-full border border-white/20 bg-white/10" aria-hidden="true" />
          <span className="absolute -bottom-28 right-20 h-56 w-56 rounded-full border border-white/15" aria-hidden="true" />
          <div className="relative flex h-full flex-col justify-between gap-14">
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/16 backdrop-blur-sm">
                <PlusCircle className="h-7 w-7" aria-hidden="true" />
              </span>
              <span className="rounded-full bg-white/14 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
                Najpogostejša naloga
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-100">Voden vnos od kupca do bizBoxa</p>
              <h2 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">Nov račun</h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-blue-50/90">
                Dodaj prejemnika in postavke. Obvezna polja, DDV in eSLOG preverimo sproti.
              </p>
              <span className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#075fb8] transition group-hover:translate-x-1">
                Začni račun
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
          </div>
        </Link>

        <div className="grid gap-4 sm:grid-cols-2">
          <DashboardAction href="/inbox" icon={Inbox} title="Prejeti računi" detail={documentsLoading ? "Nalagam ..." : `${stats.receivedCount} dokumentov`} />
          <DashboardAction href="/sent" icon={Send} title="Poslani računi" detail={sentLoading ? "Nalagam ..." : `${stats.sentCount} dokumentov`} />
          <DashboardAction href="/customers" icon={Users} title="Stranke" detail={`${stats.customerCount} v imeniku`} />
          <DashboardAction href="/settings" icon={Settings} title="Nastavitve" detail="Podjetje in privzete vrednosti" />
        </div>
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-5 py-4 text-sm">
        <div>
          <span className="font-semibold">{activeCompany?.name || "Aktivno podjetje ni izbrano"}</span>
          {activeCompany && <span className="app-muted ml-2">{activeCompany.vatNumber || activeCompany.taxId}</span>}
        </div>
        <Link href="/invoices/xml" className="inline-flex items-center gap-2 font-semibold text-[var(--app-primary-strong)] hover:underline">
          <Upload className="h-4 w-4" aria-hidden="true" />
          Uvozi obstoječi XML
        </Link>
      </div>

      <div className="mb-5 mt-16">
        <p className="text-sm font-semibold text-[var(--app-primary-strong)]">Kratek pregled</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Samo številke, ki zahtevajo pozornost</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          href="/sent"
          label="Poslani ta mesec"
          value={monthlySentCount}
          detail="uspešno pripravljeni računi"
          icon={Send}
          tone="blue"
          loading={statsLoading && monthlySentCount === 0}
        />
        <StatCard
          href="/inbox"
          label="Prejeti ta mesec"
          value={monthlyReceivedCount}
          detail="novi prejeti računi"
          icon={Inbox}
          tone="green"
          loading={statsLoading && monthlyReceivedCount === 0}
        />
        <StatCard
          href="/acknowledgments?status=error"
          label="Napake za pregled"
          value={stats.failedAcknowledgementCount}
          detail="povratnice, ki potrebujejo ukrep"
          icon={AlertCircle}
          tone="red"
          loading={statsLoading && stats.failedAcknowledgementCount === 0}
        />
      </div>

      <div className="mt-12">
        <div className="space-y-6">
          <section className="solid-panel overflow-hidden rounded-[2rem]">
            <PanelHeader
              title="Zadnje aktivnosti"
              actionHref="/inbox"
              actionLabel="Poglej vse"
            />

            <div className="divide-y divide-[var(--app-border)]">
              {activityLoading && latestReceived.length === 0 && latestSent.length === 0 && latestAcks.length === 0 && (
                <div className="app-muted px-5 py-6">Nalagam zadnjo aktivnost ...</div>
              )}
              {!activityLoading && latestReceived.length === 0 && latestSent.length === 0 && latestAcks.length === 0 && (
                <EmptyState text="Ni zadnje aktivnosti za prikaz." />
              )}
              {latestReceived.slice(0, 2).map((doc) => (
                <ActivityRow
                  key={`received-${doc.id}`}
                  href={`/inbox/${doc.id}`}
                  icon={Inbox}
                  typeLabel="Prejeti račun"
                  title={doc.number}
                  subtitle={doc.sender}
                  date={doc.date}
                  status="Prejeto"
                  tone="blue"
                />
              ))}
              {latestSent.slice(0, 2).map((invoice, index) => (
                <ActivityRow
                  key={`sent-${invoice.id || invoice.docId || invoice.number || index}`}
                  href={invoice.id || invoice.docId ? `/inbox/${invoice.id || invoice.docId}` : "/sent"}
                  icon={Send}
                  typeLabel="Poslani račun"
                  title={invoice.number || "Brez številke"}
                  subtitle={invoice.receiver || invoice.buyer?.name || "Prejemnik ni vpisan"}
                  date={invoice.date || invoice.sentAt || "-"}
                  status={invoice.status || "Poslano"}
                  tone="green"
                />
              ))}
              {latestAcks.slice(0, 2).map((doc) => {
                const hasError = isErrorAck(doc);

                return (
                  <ActivityRow
                    key={`ack-${doc.id}`}
                    href={`/inbox/${doc.id}`}
                    icon={hasError ? AlertCircle : FileCheck2}
                    typeLabel="Povratnica"
                    title={doc.number}
                    subtitle={getParam(doc, "RefMsgId") || getParam(doc, "Opis") || doc.sender}
                    date={doc.date}
                    status={hasError ? "Napaka" : "Sprejeto"}
                    tone={hasError ? "red" : "amber"}
                  />
                );
              })}
            </div>
          </section>

          <section className="hidden">
            <PanelHeader title="Povratnice in napake" actionHref="/acknowledgments" actionLabel="Vse povratnice" />

            <div className="border-b border-[var(--app-border)] px-5 pb-4">
              <div className="flex flex-wrap gap-2">
                <FilterButton active={ackFilter === "all"} onClick={() => setAckFilter("all")}>
                  Vse
                </FilterButton>
                <FilterButton active={ackFilter === "success"} onClick={() => setAckFilter("success")}>
                  Uspešne
                </FilterButton>
                <FilterButton active={ackFilter === "error"} onClick={() => setAckFilter("error")}>
                  Napake
                </FilterButton>
                <FilterButton active={ackFilter === "pending"} onClick={() => setAckFilter("pending")}>
                  Čakajoče
                </FilterButton>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[1.3fr_0.8fr_0.8fr_1.3fr_0.8fr] gap-3 border-b border-[var(--app-border)] px-5 py-3 text-xs font-semibold app-muted">
                  <div>Dokument</div>
                  <div>Tip</div>
                  <div>Status</div>
                  <div>Sporočilo</div>
                  <div>Prejeto</div>
                </div>

                {documentsLoading && displayedAcks.length === 0 && (
                  <div className="app-muted px-5 py-6">Nalagam povratnice ...</div>
                )}
                {!documentsLoading && displayedAcks.length === 0 && (
                  <div className="app-muted px-5 py-6">Ni povratnic za izbrani filter.</div>
                )}

                {displayedAcks.map((doc) => {
                  const hasError = isErrorAck(doc);
                  const status = getParam(doc, "VrstaPotrditve") || doc.status || "-";
                  const message = getParam(doc, "Opis") || getParam(doc, "RefMsgId") || "-";

                  return (
                    <Link
                      key={doc.id}
                      href={`/inbox/${doc.id}`}
                      className="grid grid-cols-[1.3fr_0.8fr_0.8fr_1.3fr_0.8fr] gap-3 border-b border-[var(--app-border)] px-5 py-4 text-sm last:border-b-0 hover:bg-[var(--app-soft)]"
                    >
                      <div className="font-semibold">{doc.number}</div>
                      <div className="app-muted">{doc.type}</div>
                      <div>
                        <StatusBadge tone={hasError ? "red" : "green"}>
                          {hasError ? "Napaka" : status}
                        </StatusBadge>
                      </div>
                      <div className="app-muted truncate">{message}</div>
                      <div className="app-muted">{doc.date}</div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <aside className="hidden">
          <section className="solid-panel rounded-[1.5rem] p-5">
            <h2 className="text-lg font-semibold">Naslednji korak</h2>
            <div className={`mt-4 rounded-2xl border p-4 ${
              stats.failedAcknowledgementCount > 0
                ? "border-red-500/25 bg-red-500/10"
                : "border-[var(--app-border)] bg-[var(--app-soft)]"
            }`}>
              <div className={stats.failedAcknowledgementCount > 0 ? "text-red-500" : "text-[var(--app-primary-strong)]"}>
                <AlertCircle className="mb-2 h-4 w-4" aria-hidden="true" />
                <div className="font-semibold">
                  {stats.failedAcknowledgementCount > 0
                    ? `Imaš ${stats.failedAcknowledgementCount} neuspešnih povratnic`
                    : draftInvoices.length > 0
                      ? "Nadaljuj odprt osnutek"
                      : "Ustvari nov eSLOG račun"}
                </div>
                <div className="mt-1 text-sm opacity-80">
                  {stats.failedAcknowledgementCount > 0
                    ? "Preglej in ukrepaj."
                    : "Pripravi naslednji dokument."}
                </div>
              </div>
              <Link
                href={stats.failedAcknowledgementCount > 0 ? "/acknowledgments?status=error" : "/invoices/new"}
                className="primary-button mt-4 h-10 w-full px-4 text-sm"
              >
                {stats.failedAcknowledgementCount > 0 ? "Preveri napake" : "Odpri obrazec"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="mt-4 space-y-2">
              <NextStepLink href="/drafts" label="Nadaljuj osnutek" count={stats.draftCount} />
              <NextStepLink href="/invoices/new" label="Ustvari nov eSLOG račun" />
              <NextStepLink href="/invoices/xml" label="Uvozi XML datoteko" />
            </div>
          </section>

          <section className="solid-panel rounded-[1.5rem] p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">Aktivno podjetje</h2>
              <StatusBadge tone="green">Aktivno</StatusBadge>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div>
                <div className="font-semibold">{activeCompany?.name || "-"}</div>
                <div className="app-muted mt-1">
                  Davčna št.: {activeCompany?.vatNumber || activeCompany?.taxId || "-"}
                </div>
              </div>
              <Info label="eNaslov" value={activeCompany?.eAddress} />
              <Info label="eLokacija" value={activeCompany?.eLocation} />
            </div>

            <Link href="/settings" className="secondary-button mt-4 h-10 w-full px-4 text-sm">
              Uredi podjetje
            </Link>
          </section>


          <section className="solid-panel rounded-[1.5rem] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Hitri račun</h2>
                <p className="app-muted mt-1 text-sm">
                  Začni račun direktno iz priljubljene stranke.
                </p>
              </div>
              <StatusBadge tone="amber">{favoriteCustomers.length}</StatusBadge>
            </div>

            <div className="mt-4 space-y-3">
              {favoriteCustomers.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-soft)] p-4 text-sm">
                  <div className="font-semibold">Ni še priljubljenih strank</div>
                  <p className="app-muted mt-1">
                    V šifrantu označi stranko z zvezdico, potem bo tukaj na voljo gumb za hiter račun.
                  </p>
                  <Link href="/customers" className="secondary-button mt-4 h-10 w-full px-4 text-sm">
                    Odpri stranke
                  </Link>
                </div>
              )}

              {favoriteCustomers.map((customer) => (
                <FavoriteCustomerCard key={customer.vatNumber} customer={customer} />
              ))}
            </div>

            {favoriteCustomers.length > 0 && (
              <Link href="/customers" className="secondary-button mt-4 h-10 w-full px-4 text-sm">
                Uredi priljubljene
              </Link>
            )}
          </section>

          <section className="solid-panel rounded-[1.5rem] p-5">
            <h2 className="text-lg font-semibold">Hitre bližnjice</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <QuickLink href="/invoices/new" icon={PlusCircle} label="Nov račun" />
              <QuickLink href="/inbox" icon={Inbox} label="Prejeti računi" />
              <QuickLink href="/sent" icon={Send} label="Poslani računi" />
              <QuickLink href="/acknowledgments?status=error" icon={AlertCircle} label="Napake" danger />
              <QuickLink href="/drafts" icon={FileClock} label="Osnutki" />
              <QuickLink href="/customers" icon={Users} label="Stranke" />
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}

function DashboardAction({
  href,
  icon: Icon,
  title,
  detail,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-40 flex-col justify-between rounded-[1.75rem] border border-[var(--app-border)] bg-[var(--app-surface-strong)] p-5 shadow-[var(--app-shadow-soft)] transition hover:-translate-y-1 hover:border-[var(--app-primary)] hover:shadow-[var(--app-shadow)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--app-soft)] text-[var(--app-primary-strong)]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <ArrowRight className="h-4 w-4 text-[var(--app-muted)] transition group-hover:translate-x-1 group-hover:text-[var(--app-primary)]" aria-hidden="true" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="app-muted mt-1 text-sm">{detail}</p>
      </div>
    </Link>
  );
}


function FavoriteCustomerCard({ customer }: { customer: ClientCustomer }) {
  const vat = customer.vatNumber || "";

  return (
    <Link
      href={`/invoices/new?vat=${encodeURIComponent(vat)}`}
      className="group block rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--app-primary)] hover:bg-[var(--app-soft)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold">{customer.name || "Brez naziva"}</div>
          <div className="app-muted mt-1 truncate text-xs">{vat || "Davčna ni vpisana"}</div>
          <div className="app-muted mt-1 truncate text-xs">{customer.eLocation || customer.eAddress || "eLokacija ni vpisana"}</div>
        </div>
        <div className="rounded-xl bg-[var(--app-soft)] p-2 text-[var(--app-primary-strong)] transition group-hover:bg-[var(--app-primary)] group-hover:text-white">
          <PlusCircle className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
      <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--app-primary-strong)]">
        Nov račun
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </div>
    </Link>
  );
}

function StatCard({
  href,
  label,
  value,
  detail,
  icon: Icon,
  tone = "blue",
  loading = false,
}: {
  href?: string;
  label: string;
  value: number;
  detail?: string;
  icon: React.ElementType;
  tone?: "blue" | "amber" | "red" | "violet" | "green";
  loading?: boolean;
}) {
  const toneClass = {
    blue: "bg-blue-500/10 text-[var(--app-primary)]",
    amber: "bg-amber-500/10 text-amber-500",
    red: "bg-red-500/10 text-red-500",
    violet: "bg-violet-500/10 text-violet-500",
    green: "bg-emerald-500/10 text-emerald-500",
  }[tone];

  const content = (
    <>
      <div
        className={`mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ${toneClass}`}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="app-muted text-sm font-medium">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">
        {loading ? "..." : value}
      </div>
      {detail && <div className="app-muted mt-2 min-h-5 text-xs">{detail}</div>}
      <div className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-[var(--app-primary-strong)]">
        Prikaži
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </div>
    </>
  );

  const className =
    "solid-panel block rounded-[1.75rem] p-6 hover:-translate-y-0.5 hover:border-[var(--app-primary)] sm:p-7";

  if (!href) return <div className={className}>{content}</div>;

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

function PanelHeader({
  title,
  actionHref,
  actionLabel,
}: {
  title: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--app-border)] px-6 py-5">
      <h2 className="text-xl font-semibold">{title}</h2>
      <Link href={actionHref} className="text-xs font-semibold text-[var(--app-primary-strong)]">
        {actionLabel}
      </Link>
    </div>
  );
}

function ActivityRow({
  href,
  icon: Icon,
  typeLabel,
  title,
  subtitle,
  date,
  status,
  tone,
}: {
  href: string;
  icon: React.ElementType;
  typeLabel: string;
  title: string;
  subtitle?: string;
  date?: string;
  status: string;
  tone: "blue" | "green" | "amber" | "red";
}) {
  const iconClass = {
    blue: "bg-blue-500/10 text-[var(--app-primary)]",
    green: "bg-emerald-500/10 text-emerald-500",
    amber: "bg-amber-500/10 text-amber-500",
    red: "bg-red-500/10 text-red-500",
  }[tone];

  return (
    <Link href={href} className="grid grid-cols-[auto_1fr_auto] gap-4 px-6 py-5 hover:bg-[var(--app-soft)]">
      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${iconClass}`}>
        <Icon className="h-4.5 w-4.5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <StatusBadge tone={tone}>{typeLabel}</StatusBadge>
        <div className="mt-1 truncate font-semibold">{title}</div>
        <div className="app-muted mt-1 truncate text-sm">{subtitle || "-"}</div>
      </div>
      <div className="text-right text-xs">
        <div className="app-muted">{date || "-"}</div>
        <div className="mt-2">
          <StatusBadge tone={tone}>{status}</StatusBadge>
        </div>
      </div>
    </Link>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-xs font-semibold ${
        active
          ? "border-[var(--app-primary)] bg-[var(--app-soft)] text-[var(--app-primary-strong)]"
          : "border-[var(--app-border)] app-muted hover:bg-[var(--app-soft)]"
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({
  tone,
  children,
}: {
  tone: "blue" | "green" | "amber" | "red";
  children: React.ReactNode;
}) {
  const className = {
    blue: "bg-blue-500/10 text-[var(--app-primary-strong)]",
    green: "bg-emerald-500/10 text-emerald-500",
    amber: "bg-amber-500/10 text-amber-500",
    red: "bg-red-500/10 text-red-500",
  }[tone];

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}

function NextStepLink({
  href,
  label,
  count,
}: {
  href: string;
  label: string;
  count?: number;
}) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-xl px-2 py-2 text-sm hover:bg-[var(--app-soft)]">
      <span className="font-medium">{label}</span>
      <span className="flex items-center gap-2 app-muted">
        {typeof count === "number" && (
          <span className="rounded-full bg-[var(--app-soft)] px-2 py-0.5 text-xs font-semibold">
            {count}
          </span>
        )}
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </Link>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  danger,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-3 text-xs font-semibold hover:bg-[var(--app-soft)]"
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${danger ? "text-red-500" : "text-[var(--app-primary)]"}`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </Link>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="app-muted px-5 py-6 text-sm">{text}</div>;
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
      <div className="app-muted text-xs">{label}</div>
      <div className="mt-1 break-words font-semibold">{value || "-"}</div>
    </div>
  );
}
