"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

function getParam(metadata: any, name: string) {
  const params = metadata?.parameters?.param || [];
  const found = params.find((item: any) => item.parameterName === name);
  return found?.parameterValue || "";
}

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

  const invoiceInfo = useMemo(() => {
    if (!metadata) return null;

    return {
      supplierName: getParam(metadata, "P_Naziv") || metadata.organization || "-",
      supplierTaxId: getParam(metadata, "P_TAXID") || "-",
      buyerName: getParam(metadata, "BY_Naziv") || "-",
      buyerTaxId: getParam(metadata, "BY_TAXID") || "-",
      amount: getParam(metadata, "Zne_Placila_Valuta") || getParam(metadata, "Zne_Placila") || "-",
      issueDate: getParam(metadata, "DatumIzdaje") || "-",
      dueDate: getParam(metadata, "DatumZapadlosti") || "-",
      serviceDate: getParam(metadata, "DatumStoritve") || "-",
      reference: getParam(metadata, "Sklic") || "-",
      title: getParam(metadata, "Naslov") || metadata.title || "-",
      type: getParam(metadata, "DOC_ROLE_TYPE") || metadata.type || "-",
      accepted: getParam(metadata, "ACCEPTED") || "-",
      acceptedTime: getParam(metadata, "ACCEPTED_TIME") || "-",
    };
  }, [metadata]);

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

          {!loading && metadata && invoiceInfo && (
            <>
              <div className="mt-8 grid gap-6 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm text-slate-400">Tip dokumenta</div>
                      <h3 className="mt-1 text-3xl font-bold">{invoiceInfo.type}</h3>
                      <p className="mt-2 text-slate-400">{invoiceInfo.title}</p>
                    </div>

                    <div className="rounded-2xl border border-green-500/20 bg-green-500/10 px-5 py-4 text-right">
                      <div className="text-sm text-green-300">Znesek za plačilo</div>
                      <div className="mt-1 text-2xl font-bold text-green-200">
                        {invoiceInfo.amount}
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 grid gap-4 md:grid-cols-2">
                    <Info label="Dobavitelj" value={invoiceInfo.supplierName} />
                    <Info label="Davčna dobavitelja" value={invoiceInfo.supplierTaxId} />
                    <Info label="Prejemnik" value={invoiceInfo.buyerName} />
                    <Info label="Davčna prejemnika" value={invoiceInfo.buyerTaxId} />
                    <Info label="Datum izdaje" value={invoiceInfo.issueDate} />
                    <Info label="Datum storitve" value={invoiceInfo.serviceDate} />
                    <Info label="Datum zapadlosti" value={invoiceInfo.dueDate} />
                    <Info label="Sklic" value={invoiceInfo.reference} />
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

                  <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Sprejeto</span>
                      <span>{invoiceInfo.accepted}</span>
                    </div>
                    <div className="mt-3 flex justify-between gap-4">
                      <span className="text-slate-500">Čas sprejema</span>
                      <span className="text-right">{invoiceInfo.acceptedTime}</span>
                    </div>
                  </div>
                </aside>
              </div>

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
            </>
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