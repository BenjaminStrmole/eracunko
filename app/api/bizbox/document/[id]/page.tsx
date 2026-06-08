"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function InboxDocumentPage() {
  const params = useParams();
  const id = String(params.id);

  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadMetadata() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/bizbox/document/${id}/metadata`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.message || "Napaka pri pridobivanju metadata.");
        setMetadata(data.raw || data);
        return;
      }

      setMetadata(data.metadata);
    } catch (err: any) {
      setError(err.message || "Napaka pri pridobivanju metadata.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMetadata();
  }, [id]);

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
              <a href="/inbox" className="text-sm text-blue-300 hover:text-blue-200">
                ← Nazaj v Inbox
              </a>

              <h2 className="mt-4 text-4xl font-bold">Prejeti dokument</h2>
              <p className="mt-2 text-slate-400">
                Dokument ID: <span className="font-semibold text-slate-200">{id}</span>
              </p>
            </div>

            <a
              href={`/api/bizbox/document/${id}`}
              className="rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500"
            >
              Prenesi ZIP
            </a>
          </div>

          {loading && (
            <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-400">
              Nalagam podatke dokumenta ...
            </div>
          )}

          {error && (
            <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-200">
              {error}
            </div>
          )}

          {!loading && metadata && (
            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
                <h3 className="text-2xl font-bold">Metadata</h3>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <Info label="Naslov" value={metadata.title} />
                  <Info label="Tip" value={metadata.type} />
                  <Info label="Datoteka" value={metadata.fileName} />
                  <Info label="Organizacija" value={metadata.organization} />
                  <Info label="Lokacija" value={metadata.creationLocation} />
                  <Info label="Klasifikacija" value={metadata.classificationName} />
                  <Info label="Skupina" value={metadata.groupName} />
                  <Info label="MIME" value={metadata.mimetype} />
                </div>
              </div>

              <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <h3 className="text-xl font-bold">Akcije</h3>

                <div className="mt-6 space-y-3">
                  <a
                    href={`/api/bizbox/document/${id}`}
                    className="block rounded-lg bg-blue-600 px-5 py-3 text-center font-semibold hover:bg-blue-500"
                  >
                    Prenesi originalni ZIP
                  </a>

                  <button
                    onClick={loadMetadata}
                    className="w-full rounded-lg border border-white/15 px-5 py-3 font-semibold hover:bg-white/10"
                  >
                    Osveži metadata
                  </button>
                </div>
              </aside>
            </div>
          )}

          {!loading && (
            <details className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <summary className="cursor-pointer font-semibold text-blue-200">
                Raw metadata
              </summary>

              <pre className="mt-4 max-h-[500px] overflow-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-300">
                {typeof metadata === "string"
                  ? metadata
                  : JSON.stringify(metadata, null, 2)}
              </pre>
            </details>
          )}
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 break-words font-semibold text-slate-200">
        {value || "-"}
      </div>
    </div>
  );
}