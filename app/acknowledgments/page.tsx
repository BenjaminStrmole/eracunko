"use client";

import { useEffect, useMemo, useState } from "react";

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
  const confirmation = (getParam(item, "VrstaPotrditve") || "").toLowerCase();

  return confirmation.startsWith("27") || confirmation.includes("-99");
}

function getBadgeStyle(value: string) {
  const text = value.toLowerCase();

  if (text.startsWith("12")) return "bg-green-500/10 text-green-300";
  if (text.startsWith("29")) return "bg-green-500/10 text-green-300";
  if (text.startsWith("27")) return "bg-red-500/10 text-red-300";
  if (text.includes("-99")) return "bg-red-500/10 text-red-300";
  if (text.startsWith("43")) return "bg-yellow-500/10 text-yellow-300";

  return "bg-blue-500/10 text-blue-200";
}

export default function AcknowledgementsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "error">("all");

  async function loadDocuments() {
    setLoading(true);
    setError("");

    try {
      const activeCompany = JSON.parse(
        localStorage.getItem("activeCompany") || "null"
      );

      const taxNumber = activeCompany?.vatNumber || activeCompany?.taxId || "";

      const response = await fetch(
        `/api/bizbox/inbox?taxNumber=${encodeURIComponent(taxNumber)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!data.success) {
        setError(data.message || "Napaka pri pridobivanju povratnic.");
        return;
      }

      setDocuments(data.documents || []);
    } catch (err: any) {
      setError(err.message || "Napaka pri pridobivanju povratnic.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");

    if (status === "error") {
      setFilter("error");
    }

    loadDocuments();
  }, []);

  const allAcknowledgements = useMemo(
    () => documents.filter(isAcknowledgement),
    [documents]
  );

  const errorAcknowledgements = useMemo(
    () => allAcknowledgements.filter(isErrorAck),
    [allAcknowledgements]
  );

  const acknowledgements = useMemo(() => {
    if (filter === "error") return errorAcknowledgements;
    return allAcknowledgements;
  }, [allAcknowledgements, errorAcknowledgements, filter]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-slate-800 bg-slate-900 p-6">
          <div className="mb-10">
            <h1 className="text-2xl font-bold">eRačunko</h1>
            <p className="text-sm text-slate-400">e-računi brez komplikacij</p>
          </div>

          <nav className="space-y-2">
            <a href="/dashboard" className="block rounded-lg px-4 py-3 hover:bg-slate-800">🏠 Domov</a>
            <a href="/inbox" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📥 Prejeti računi</a>
            <a href="/acknowledgments" className="block rounded-lg bg-blue-600/20 px-4 py-3 text-blue-200">📨 Povratnice</a>
            <a href="/sent" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📤 Poslani računi</a>
            <a href="/drafts" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📝 Osnutki</a>
            <a href="/invoices/new" className="block rounded-lg px-4 py-3 hover:bg-slate-800">🧾 Nov račun</a>
            <a href="/customers" className="block rounded-lg px-4 py-3 hover:bg-slate-800">👥 Moje stranke</a>
            <a href="/settings" className="block rounded-lg px-4 py-3 hover:bg-slate-800">⚙️ Nastavitve</a>
          </nav>
        </aside>

        <section className="flex-1 p-10">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-4xl font-bold">Povratnice</h2>
              <p className="mt-2 text-slate-400">
                Pregled povratnic za izbrano aktivno podjetje.
              </p>
            </div>

            <button
              onClick={loadDocuments}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500 disabled:opacity-60"
            >
              {loading ? "Osvežujem..." : "Osveži"}
            </button>
          </div>

          <div className="mt-8 flex gap-3">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-full px-5 py-2 text-sm font-semibold ${
                filter === "all"
                  ? "bg-blue-600 text-white"
                  : "border border-slate-700 text-slate-300 hover:bg-slate-800"
              }`}
            >
              Vse povratnice ({allAcknowledgements.length})
            </button>

            <button
              onClick={() => setFilter("error")}
              className={`rounded-full px-5 py-2 text-sm font-semibold ${
                filter === "error"
                  ? "bg-red-600 text-white"
                  : "border border-red-500/30 text-red-300 hover:bg-red-500/10"
              }`}
            >
              Napake ({errorAcknowledgements.length})
            </button>
          </div>

          {error && (
            <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-200">
              {error}
            </div>
          )}

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900">
            <div className="grid grid-cols-6 border-b border-slate-800 px-6 py-4 text-sm text-slate-400">
              <div>Dokument</div>
              <div>Vrsta</div>
              <div>Ref. sporočilo</div>
              <div>Status</div>
              <div>Datum</div>
              <div>Akcija</div>
            </div>

            {loading && (
              <div className="px-6 py-8 text-slate-400">
                Nalagam povratnice ...
              </div>
            )}

            {!loading && acknowledgements.length === 0 && !error && (
              <div className="px-6 py-8 text-slate-400">
                {filter === "error"
                  ? "Ni povratnic z napako za izbrano podjetje."
                  : "Ni povratnic za izbrano podjetje."}
              </div>
            )}

            {!loading &&
              acknowledgements.map((doc) => {
                const confirmationType =
                  getParam(doc, "VrstaPotrditve") || doc.number;
                const refMsgId = getParam(doc, "RefMsgId") || "-";
                const issueDate = getParam(doc, "DatumIzdaje") || doc.date;
                const roleType = getParam(doc, "DOC_ROLE_TYPE") || doc.type;

                return (
                  <a
                    key={doc.id}
                    href={`/inbox/${doc.id}`}
                    className="grid grid-cols-6 border-b border-slate-800 px-6 py-4 last:border-b-0 hover:bg-slate-800/70"
                  >
                    <div className="font-medium">{doc.number}</div>
                    <div className="text-slate-300">{roleType}</div>
                    <div className="text-slate-300">{refMsgId}</div>
                    <div>
                      <span
                        className={`rounded-full px-3 py-1 text-sm ${getBadgeStyle(
                          confirmationType
                        )}`}
                      >
                        {confirmationType}
                      </span>
                    </div>
                    <div className="text-slate-300">{issueDate}</div>
                    <div className="text-blue-300">Odpri →</div>
                  </a>
                );
              })}
          </div>
        </section>
      </div>
    </main>
  );
}