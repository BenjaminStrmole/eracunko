"use client";

import { useEffect, useState } from "react";

type InboxDocument = {
  id: string;
  number: string;
  sender: string;
  type: string;
  status: string;
  date: string;
  raw?: any;
};

export default function InboxPage() {
  const [documents, setDocuments] = useState<InboxDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [raw, setRaw] = useState<any>(null);

  async function loadInbox() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/bizbox/inbox", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.message || "Napaka pri pridobivanju inboxa.");
        setRaw(data.raw || data);
        return;
      }

      setDocuments(data.documents || []);
      setRaw(data.raw);
    } catch (err: any) {
      setError(err.message || "Napaka pri pridobivanju inboxa.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInbox();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-slate-800 bg-slate-900 p-6">
          <div className="mb-10">
            <h1 className="text-2xl font-bold">eRačunko</h1>
            <p className="text-sm text-slate-400">e-računi brez komplikacij</p>
          </div>

          <nav className="space-y-2">
            <a href="/dashboard" className="block rounded-lg px-4 py-3 hover:bg-slate-800">🏠 Dashboard</a>
            <a href="/inbox" className="block rounded-lg bg-blue-600/20 px-4 py-3 text-blue-200">📥 Inbox</a>
            <a href="/sent" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📤 Poslani računi</a>
            <a href="/drafts" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📝 Osnutki</a>
            <a href="/invoices/new" className="block rounded-lg px-4 py-3 hover:bg-slate-800">➕ Nov račun</a>
            <a href="/customers" className="block rounded-lg px-4 py-3 hover:bg-slate-800">👥 Stranke</a>
            <a href="/settings" className="block rounded-lg px-4 py-3 hover:bg-slate-800">⚙️ Nastavitve</a>
          </nav>
        </aside>

        <section className="flex-1 p-10">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-4xl font-bold">Inbox</h2>
              <p className="mt-2 text-slate-400">
                Pregled dokumentov iz bizBox DEMO okolja.
              </p>
            </div>

            <button
              onClick={loadInbox}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500 disabled:opacity-60"
            >
              {loading ? "Osvežujem..." : "Osveži"}
            </button>
          </div>

          {error && (
            <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-200">
              {error}
            </div>
          )}

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900">
            <div className="grid grid-cols-5 border-b border-slate-800 px-6 py-4 text-sm text-slate-400">
              <div>Številka</div>
              <div>Pošiljatelj</div>
              <div>Tip</div>
              <div>Status</div>
              <div>Datum</div>
            </div>

            {loading && (
              <div className="px-6 py-8 text-slate-400">
                Nalagam dokumente iz bizBox ...
              </div>
            )}

            {!loading && documents.length === 0 && !error && (
              <div className="px-6 py-8 text-slate-400">
                Ni prejetih dokumentov ali pa endpoint vrača drugačno strukturo.
              </div>
            )}

            {!loading &&
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="grid grid-cols-5 border-b border-slate-800 px-6 py-4 last:border-b-0"
                >
                  <div className="font-medium">{doc.number}</div>
                  <div className="text-slate-300">{doc.sender}</div>
                  <div className="text-slate-300">{doc.type}</div>
                  <div>
                    <span className="rounded-full bg-blue-500/10 px-3 py-1 text-sm text-blue-200">
                      {doc.status}
                    </span>
                  </div>
                  <div className="text-slate-300">{doc.date}</div>
                </div>
              ))}
          </div>

          {raw && (
            <details className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <summary className="cursor-pointer font-semibold text-blue-200">
                Debug raw response
              </summary>

              <pre className="mt-4 max-h-[500px] overflow-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-300">
                {typeof raw === "string" ? raw : JSON.stringify(raw, null, 2)}
              </pre>
            </details>
          )}
        </section>
      </div>
    </main>
  );
}