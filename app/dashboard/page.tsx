"use client";

import {
  AlertCircle,
  ArrowRight,
  FileCheck2,
  FileClock,
  Inbox,
  Send,
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
};

type DocumentItem = {
  id: string;
  number: string;
  sender: string;
  type: string;
  status: string;
  date: string;
  raw?: RawDocument;
  parameters?: {
    param?: RawParam[];
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
  buyer?: {
    name?: string;
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
  const params = item.raw?.parameters?.param || item.parameters?.param || [];
  const found = params.find((param) => param.parameterName === name);
  return found?.parameterValue || "";
}

function isAcknowledgement(item: DocumentItem) {
  const actualType = getParam(item, "ACTUAL_TYPE");
  const roleType = getParam(item, "DOC_ROLE_TYPE");
  const classification =
    item.raw?.classificationname || item.raw?.classificationName || "";

  return (
    item.type === "Povratnica" ||
    actualType === "IFTMAN" ||
    roleType.toLowerCase().includes("povratnica") ||
    classification.toLowerCase().includes("iftman")
  );
}

function isErrorAck(item: DocumentItem) {
  const confirmation = (getParam(item, "VrstaPotrditve") || "").toLowerCase();
  return confirmation.startsWith("27") || confirmation.includes("-99");
}

export default function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeCompany, setActiveCompany] = useState<ActiveCompany | null>(null);
  const [sentInvoices, setSentInvoices] = useState<LocalInvoice[]>([]);
  const [draftInvoices, setDraftInvoices] = useState<LocalInvoice[]>([]);
  const [sentCount, setSentCount] = useState(0);
  const [draftCount, setDraftCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    setLoading(true);

    const company = JSON.parse(
      localStorage.getItem("activeCompany") || "null"
    ) as ActiveCompany | null;
    const sent = safeJsonParse<LocalInvoice[]>(localStorage.getItem("sent"), []);
    const drafts = safeJsonParse<LocalInvoice[]>(
      localStorage.getItem("drafts"),
      []
    );
    const customers = safeJsonParse<unknown[]>(
      localStorage.getItem("customers"),
      []
    );

    setActiveCompany(company);
    setSentInvoices(sent);
    setDraftInvoices(drafts);
    setSentCount(sent.length);
    setDraftCount(drafts.length);
    setCustomerCount(customers.length);

    try {
      const taxNumber = company?.vatNumber || company?.taxId || "";
      const response = await fetch(
        `/api/bizbox/inbox?taxNumber=${encodeURIComponent(taxNumber)}`,
        { cache: "no-store" }
      );
      const data = await response.json();

      if (data.success) {
        setDocuments(data.documents || []);
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
  const sentTotal = sentInvoices.reduce(
    (sum, invoice) => sum + (invoice.totals?.gross || invoice.totals?.payable || 0),
    0
  );
  const draftTotal = draftInvoices.reduce(
    (sum, invoice) => sum + (invoice.totals?.gross || invoice.totals?.payable || 0),
    0
  );
  const latestSent = sentInvoices.slice(-5).reverse();
  const latestDrafts = draftInvoices.slice(0, 5);

  return (
    <AppShell>
      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="status-pill mb-4 inline-flex">Pregled poslovanja</div>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Domov
          </h1>
          <p className="app-muted mt-3 max-w-2xl text-base">
            Ključni statusi e-računov, povratnic, osnutkov in strank za aktivno
            podjetje.
          </p>
        </div>

        <Link href="/invoices/new" className="primary-button h-12 px-6">
          Nov račun
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mb-8">
        <CompanySelector />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard
          href="/inbox"
          label="Prejeti računi"
          value={receivedInvoices.length}
          icon={Inbox}
        />
        <StatCard
          href="/acknowledgments"
          label="Povratnice"
          value={acknowledgements.length}
          icon={FileCheck2}
        />
        <StatCard href="/sent" label="Poslani" value={sentCount} icon={Send} />
        <StatCard
          href="/drafts"
          label="Osnutki"
          value={draftCount}
          icon={FileClock}
        />
        <StatCard
          href="/customers"
          label="Stranke"
          value={customerCount}
          icon={Users}
        />
        <StatCard
          label="Napake"
          value={errorAcks.length}
          icon={AlertCircle}
          danger
        />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <MoneyCard
          label="Vrednost poslanih"
          value={formatMoney(sentTotal)}
          detail={`${sentInvoices.length} lokalno shranjenih poslanih računov`}
        />
        <MoneyCard
          label="Vrednost osnutkov"
          value={formatMoney(draftTotal)}
          detail={`${draftInvoices.length} odprtih osnutkov`}
        />
        <div className="solid-panel rounded-[1.5rem] p-5">
          <div className="app-muted text-sm font-medium">Naslednji korak</div>
          <div className="mt-2 text-lg font-semibold">
            {draftInvoices.length > 0
              ? "Dokončaj osnutek računa"
              : "Ustvari nov eSLOG račun"}
          </div>
          <Link href="/invoices/new" className="secondary-button mt-4 h-10 px-4 text-sm">
            Odpri obrazec
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <div className="solid-panel rounded-[1.75rem] p-6 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Zadnje povratnice</h2>
              <p className="app-muted mt-1 text-sm">
                Hitri pregled uspešnih in zavrnjenih potrditev.
              </p>
            </div>
            <Link href="/acknowledgments" className="secondary-button h-10 px-4 text-sm">
              Vse povratnice
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {loading && <div className="app-muted">Nalagam podatke ...</div>}

            {!loading && latestAcks.length === 0 && (
              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-soft)] p-5 app-muted">
                Ni povratnic za prikaz.
              </div>
            )}

            {latestAcks.map((doc) => {
              const status = getParam(doc, "VrstaPotrditve") || doc.number;
              const ref = getParam(doc, "RefMsgId") || "-";
              const hasError = isErrorAck(doc);

              return (
                <Link
                  key={doc.id}
                  href={`/inbox/${doc.id}`}
                  className="flex items-center justify-between rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 hover:bg-[var(--app-soft)]"
                >
                  <div>
                    <div className="font-semibold">{status}</div>
                    <div className="app-muted mt-1 text-sm">RefMsgId: {ref}</div>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${
                      hasError
                        ? "bg-red-500/10 text-red-500"
                        : "bg-emerald-500/10 text-emerald-500"
                    }`}
                  >
                    {hasError ? "Napaka" : "OK"}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        <aside className="glass-panel rounded-[1.75rem] p-6">
          <h2 className="text-xl font-semibold">Aktivno podjetje</h2>
          <p className="app-muted mt-1 text-sm">
            Podatki, ki se uporabijo pri pripravi računov.
          </p>

          <div className="mt-5 space-y-3 text-sm">
            <Info label="Naziv" value={activeCompany?.name} />
            <Info
              label="Davčna"
              value={activeCompany?.vatNumber || activeCompany?.taxId}
            />
            <Info label="eLokacija" value={activeCompany?.eLocation} />
            <Info label="eNaslov" value={activeCompany?.eAddress} />
          </div>
        </aside>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <DocumentListPanel
          title="Zadnji poslani računi"
          emptyText="Ni lokalno shranjenih poslanih računov."
          invoices={latestSent}
          href="/sent"
        />
        <DocumentListPanel
          title="Zadnji osnutki"
          emptyText="Ni odprtih osnutkov."
          invoices={latestDrafts}
          href="/drafts"
        />
      </div>
    </AppShell>
  );
}

function StatCard({
  href,
  label,
  value,
  icon: Icon,
  danger,
}: {
  href?: string;
  label: string;
  value: number;
  icon: React.ElementType;
  danger?: boolean;
}) {
  const content = (
    <>
      <div
        className={`mb-5 flex h-11 w-11 items-center justify-center rounded-2xl ${
          danger ? "bg-red-500/10 text-red-500" : "bg-[var(--app-soft)] text-[var(--app-primary)]"
        }`}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="app-muted text-sm font-medium">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
    </>
  );

  const className =
    "solid-panel block rounded-[1.5rem] p-5 hover:-translate-y-0.5 hover:border-[var(--app-primary)]";

  if (!href) return <div className={className}>{content}</div>;

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

function MoneyCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="solid-panel rounded-[1.5rem] p-5">
      <div className="app-muted text-sm font-medium">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="app-muted mt-2 text-sm">{detail}</div>
    </div>
  );
}

function DocumentListPanel({
  title,
  emptyText,
  invoices,
  href,
}: {
  title: string;
  emptyText: string;
  invoices: LocalInvoice[];
  href: string;
}) {
  return (
    <section className="solid-panel rounded-[1.75rem] p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <Link href={href} className="secondary-button h-10 px-4 text-sm">
          Odpri
        </Link>
      </div>

      <div className="mt-5 space-y-3">
        {invoices.length === 0 && (
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-soft)] p-5 app-muted">
            {emptyText}
          </div>
        )}

        {invoices.map((invoice, index) => (
          <div
            key={`${invoice.number || "invoice"}-${index}`}
            className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold">{invoice.number || "Brez številke"}</div>
                <div className="app-muted mt-1 text-sm">
                  {invoice.buyer?.name || "Kupec ni vpisan"}
                </div>
              </div>
              <div className="text-right font-semibold">
                {formatMoney(invoice.totals?.gross || invoice.totals?.payable || 0)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
      <div className="app-muted">{label}</div>
      <div className="mt-1 break-words font-semibold">{value || "-"}</div>
    </div>
  );
}
