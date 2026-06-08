"use client";

import { useEffect, useMemo, useState } from "react";
import LogoutButton from "../components/LogoutButton";
import CompanySelector from "../components/CompanySelector";

type DocumentItem = {
  id: string;
  number: string;
  sender: string;
  type: string;
  status: string;
  date: string;
  raw?: any;
};

function getParam(item: any, name: string) {
  const params = item?.raw?.parameters?.param || item?.parameters?.param || [];
  const found = params.find((param: any) => param.parameterName === name);
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
  const confirmation = getParam(item, "VrstaPotrditve").toLowerCase();
  return (
    confirmation.includes("-99") ||
    confirmation.includes("27") ||
    confirmation.includes("29") ||
    confirmation.includes("zavrn") ||
    confirmation.includes("napak")
  );
}

export default function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeCompany, setActiveCompany] = useState<any>(null);
  const [sentCount, setSentCount] = useState(0);
  const [draftCount, setDraftCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    setLoading(true);

    const company = JSON.parse(localStorage.getItem("activeCompany") || "null");
    setActiveCompany(company);

    setSentCount(JSON.parse(localStorage.getItem("sent") || "[]").length);
    setDraftCount(JSON.parse(localStorage.getItem("drafts") || "[]").length);
    setCustomerCount(JSON.parse(localStorage.getItem("customers") || "[]").length);

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
    loadDashboard();
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

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-slate-800 bg-slate-900 p-6">
          <div className="mb-10">
            <h1 className="text-2xl font-bold">eRačunko</h1>
            <p className="text-sm text-slate-400">e-računi brez komplikacij</p>
          </div>

          <nav className="space-y-2">
            <a href="/dashboard" className="block rounded-lg bg-blue-600/20 px-4 py-3 text-blue-200">🏠 Domov</a>
            <a href="/inbox" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📥 Prejeti računi</a>
            <a href="/acknowledgments" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📨 Povratnice</a>
            <a href="/sent" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📤 Poslani računi</a>
            <a href="/drafts" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📝 Osnutki</a>
            <a href="/invoices/new" className="block rounded-lg px-4 py-3 hover:bg-slate-800">🧾 Nov račun</a>
            <a href="/customers" className="block rounded-lg px-4 py-3 hover:bg-slate-800">👥 Moje stranke</a>
            <a href="/settings" className="block rounded-lg px-4 py-3 hover:bg-slate-800">⚙️ Nastavitve</a>
            <LogoutButton />
          </nav>
        </aside>

        <section className="flex-1 p-10">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-4xl font-bold">Domov</h2>
              <p className="mt-2 text-slate-400">
                Pregled aktivnega podjetja, prejetih računov, povratnic in osnutkov.
              </p>
            </div>

            <a
              href="/invoices/new"
              className="rounded-full bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
            >
              + Nov račun
            </a>
          </div>

          <div className="mb-8">
            <CompanySelector />
          </div>

          <div className="grid gap-6 md:grid-cols-6">
            <StatCard href="/inbox" label="Prejeti računi" value={receivedInvoices.length} />
            <StatCard href="/acknowledgments" label="Povratnice" value={acknowledgements.length} />
            <StatCard href="/sent" label="Poslani računi" value={sentCount} />
            <StatCard href="/drafts" label="Osnutki" value={draftCount} />
            <StatCard href="/customers" label="Moje stranke" value={customerCount} />
            <StatCard label="Napake" value={errorAcks.length} danger />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
              <h3 className="text-xl font-bold">Zadnje povratnice</h3>

              <div className="mt-5 space-y-3">
                {loading && <div className="text-slate-400">Nalagam podatke ...</div>}

                {!loading && latestAcks.length === 0 && (
                  <div className="text-slate-400">Ni povratnic.</div>
                )}

                {latestAcks.map((doc) => {
                  const status = getParam(doc, "VrstaPotrditve") || doc.number;
                  const ref = getParam(doc, "RefMsgId") || "-";

                  return (
                    <a
                      key={doc.id}
                      href={`/inbox/${doc.id}`}
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-4 hover:bg-slate-800"
                    >
                      <div>
                        <div className="font-semibold">{status}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          RefMsgId: {ref}
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-sm ${
                          isErrorAck(doc)
                            ? "bg-red-500/10 text-red-300"
                            : "bg-green-500/10 text-green-300"
                        }`}
                      >
                        {isErrorAck(doc) ? "Napaka" : "OK"}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>

            <aside className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-6">
              <h3 className="text-xl font-bold text-blue-100">Aktivno podjetje</h3>

              <div className="mt-5 space-y-3 text-sm">
                <Info label="Naziv" value={activeCompany?.name} />
                <Info label="Davčna" value={activeCompany?.vatNumber || activeCompany?.taxId} />
                <Info label="eLokacija" value={activeCompany?.eLocation} />
                <Info label="eNaslov" value={activeCompany?.eAddress} />
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  href,
  label,
  value,
  danger,
}: {
  href?: string;
  label: string;
  value: number;
  danger?: boolean;
}) {
  const className = `rounded-2xl border p-6 ${
    danger
      ? "border-red-500/20 bg-red-500/10"
      : "border-slate-800 bg-slate-900 hover:bg-slate-800"
  }`;

  const content = (
    <>
      <div className={danger ? "text-red-300" : "text-slate-400"}>{label}</div>
      <div className="mt-3 text-4xl font-bold">{value}</div>
    </>
  );

  if (!href) return <div className={className}>{content}</div>;

  return (
    <a href={href} className={className}>
      {content}
    </a>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl border border-blue-500/20 bg-slate-950/60 p-4">
      <div className="text-slate-500">{label}</div>
      <div className="mt-1 break-words font-semibold text-slate-200">
        {value || "-"}
      </div>
    </div>
  );
}