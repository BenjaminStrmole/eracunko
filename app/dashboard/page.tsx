"use client";

import {
  AlertCircle,
  ArrowRight,
  ChevronRight,
  FileCheck2,
  FileClock,
  Inbox,
  PlusCircle,
  Send,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import CompanySelector from "../components/CompanySelector";

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

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("sl-SI", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
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
  const [ackFilter, setAckFilter] = useState<"all" | "success" | "error" | "pending">("all");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeCompany, setActiveCompany] = useState<ActiveCompany | null>(null);
  const [sentInvoices, setSentInvoices] = useState<LocalInvoice[]>([]);
  const [draftInvoices, setDraftInvoices] = useState<LocalInvoice[]>([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    setLoading(true);

    const company = JSON.parse(
      localStorage.getItem("activeCompany") || "null"
    ) as ActiveCompany | null;
    const localSent = safeJsonParse<LocalInvoice[]>(localStorage.getItem("sent"), []);
    const localDrafts = safeJsonParse<LocalInvoice[]>(
      localStorage.getItem("drafts"),
      []
    );
    const customers = safeJsonParse<unknown[]>(
      localStorage.getItem("customers"),
      []
    );

    const companySent = localSent.filter((invoice) =>
      invoiceMatchesActiveCompany(invoice, company)
    );
    const companyDrafts = localDrafts.filter((invoice) =>
      invoiceMatchesActiveCompany(invoice, company)
    );

    setActiveCompany(company);
    setSentInvoices(companySent);
    setDraftInvoices(companyDrafts);
    setCustomerCount(customers.length);

    try {
      const taxNumber = company?.vatNumber || company?.taxId || "";
      const [inboxResponse, sentResponse] = await Promise.all([
        fetch(
          `/api/bizbox/inbox?taxNumber=${encodeURIComponent(
            taxNumber
          )}&includeMetadata=true&limit=300`,
          { cache: "no-store" }
        ),
        fetch(
          `/api/bizbox/sent?taxNumber=${encodeURIComponent(taxNumber)}&limit=150`,
          { cache: "no-store" }
        ),
      ]);

      const [inboxData, sentData] = await Promise.all([
        inboxResponse.json(),
        sentResponse.json(),
      ]);

      if (inboxData.success) {
        setDocuments(inboxData.documents || []);
      } else {
        setDocuments([]);
      }

      if (sentData.success) {
        setSentInvoices(
          mergeUniqueInvoices(companySent, sentData.documents || [])
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      loadDashboard();
    });

    window.addEventListener("active-company-changed", loadDashboard);

    return () => {
      window.removeEventListener("active-company-changed", loadDashboard);
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

  const errorAcks = useMemo(
    () => acknowledgements.filter(isErrorAck),
    [acknowledgements]
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
  const latestDrafts = draftInvoices.slice(0, 5);
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

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Pregled poslovanja
          </h1>
          <p className="app-muted mt-2 max-w-2xl text-sm">
            Operativni pregled e-računov, povratnic, osnutkov in strank za aktivno podjetje.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <CompanySelector />
          <Link href="/invoices/xml" className="secondary-button h-12 px-5 text-sm">
            <Upload className="h-4 w-4" aria-hidden="true" />
            Uvozi XML
          </Link>
          <Link href="/invoices/new" className="primary-button h-12 px-6">
            Nov račun
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard
          href="/inbox"
          label="Prejeti računi"
          value={stats.receivedCount}
          detail="v aktivnem podjetju"
          icon={Inbox}
          tone="blue"
        />
        <StatCard
          href="/sent"
          label="Poslani računi"
          value={stats.sentCount}
          detail={formatMoney(stats.sentTotal)}
          icon={Send}
          tone="blue"
        />
        <StatCard
          href="/sent"
          label="Čakajo na potrditev"
          value={stats.pendingSentCount}
          detail="čakajo na povratnico"
          icon={FileCheck2}
          tone="amber"
        />
        <StatCard
          href="/acknowledgments?status=error"
          label="Napake"
          value={stats.failedAcknowledgementCount}
          detail="neuspešne povratnice"
          icon={AlertCircle}
          tone="red"
        />
        <StatCard
          href="/drafts"
          label="Osnutki"
          value={stats.draftCount}
          detail={formatMoney(stats.draftTotal)}
          icon={FileClock}
          tone="violet"
        />
        <StatCard
          href="/customers"
          label="Stranke"
          value={stats.customerCount}
          detail="v šifrantu"
          icon={Users}
          tone="green"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="solid-panel overflow-hidden rounded-[1.5rem]">
            <PanelHeader
              title="Zadnja aktivnost"
              actionHref="/inbox"
              actionLabel="Poglej vse"
            />

            <div className="divide-y divide-[var(--app-border)]">
              {loading && <div className="app-muted px-5 py-6">Nalagam podatke ...</div>}
              {!loading && latestReceived.length === 0 && latestSent.length === 0 && latestAcks.length === 0 && (
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

          <section className="solid-panel overflow-hidden rounded-[1.5rem]">
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

                {loading && <div className="app-muted px-5 py-6">Nalagam povratnice ...</div>}
                {!loading && displayedAcks.length === 0 && (
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

        <aside className="space-y-4">
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

function StatCard({
  href,
  label,
  value,
  detail,
  icon: Icon,
  tone = "blue",
}: {
  href?: string;
  label: string;
  value: number;
  detail?: string;
  icon: React.ElementType;
  tone?: "blue" | "amber" | "red" | "violet" | "green";
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
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {detail && <div className="app-muted mt-2 min-h-5 text-xs">{detail}</div>}
      <div className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-[var(--app-primary-strong)]">
        Prikaži
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </div>
    </>
  );

  const className =
    "solid-panel block min-h-44 rounded-[1.25rem] p-4 hover:-translate-y-0.5 hover:border-[var(--app-primary)] sm:p-5";

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
    <div className="flex items-center justify-between gap-4 border-b border-[var(--app-border)] px-5 py-4">
      <h2 className="text-lg font-semibold">{title}</h2>
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
    <Link href={href} className="grid grid-cols-[auto_1fr_auto] gap-4 px-5 py-4 hover:bg-[var(--app-soft)]">
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
