"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import errorPatterns from "../../../povratnice_folder_view.json";

type ErrorPattern = {
  pattern: string;
  response: string;
};

function getParam(metadata: any, name: string) {
  const params = metadata?.parameters?.param || [];
  const found = params.find((item: any) => item.parameterName === name);
  return found?.parameterValue || "";
}

function cleanErrorText(value: string) {
  return value
    .replace("[ERROR:", "")
    .replace("[ERROR", "")
    .replace("]", "")
    .trim();
}

function interpolateResponse(response: string, match: RegExpMatchArray) {
  return response
    .replace(/\$\{(\d+)\}/g, (_, index) => match[Number(index)] || "")
    .replace(/\{(\d+)\}/g, (_, index) => match[Number(index)] || "");
}

function findErrorExplanation(errorText: string) {
  if (!errorText) return "";

  for (const item of errorPatterns as ErrorPattern[]) {
    try {
      const regex = new RegExp(item.pattern, "is");
      const match = errorText.match(regex);

      if (match) {
        return interpolateResponse(item.response, match);
      }
    } catch {
      continue;
    }
  }

  return "";
}

function isAcknowledgement(metadata: any) {
  const actualType = getParam(metadata, "ACTUAL_TYPE");
  const roleType = getParam(metadata, "DOC_ROLE_TYPE");
  const classification = metadata?.classificationName || "";

  return (
    metadata?.type === "Povratnica" ||
    actualType === "IFTMAN" ||
    roleType.toLowerCase().includes("povratnica") ||
    classification.toLowerCase().includes("iftman")
  );
}

function isErrorAcknowledgement(metadata: any) {
  const confirmation = (getParam(metadata, "VrstaPotrditve") || "").toLowerCase();
  const title = String(metadata?.title || "").toLowerCase();
  const description = (getParam(metadata, "Opis") || "").toLowerCase();

  return (
    confirmation.startsWith("27") ||
    confirmation.includes("-99") ||
    title.includes("povratnica(-99)") ||
    title.includes("-99") ||
    description.includes("[error") ||
    description.includes("napaka")
  );
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

  const documentInfo = useMemo(() => {
    if (!metadata) return null;

    const acknowledgement = isAcknowledgement(metadata);
    const errorAck = isErrorAcknowledgement(metadata);
    const errorDescription = cleanErrorText(getParam(metadata, "Opis") || "");

    return {
      isAcknowledgement: acknowledgement,
      isErrorAck: errorAck,

      supplierName: getParam(metadata, "P_Naziv") || metadata.organization || "-",
      supplierTaxId: getParam(metadata, "P_TAXID") || "-",
      buyerName: getParam(metadata, "BY_Naziv") || "-",
      buyerTaxId: getParam(metadata, "BY_TAXID") || "-",

      amount:
        getParam(metadata, "Zne_Placila_Valuta") ||
        getParam(metadata, "Zne_Placila") ||
        "-",

      issueDate: getParam(metadata, "DatumIzdaje") || "-",
      receiveDate: getParam(metadata, "DatumPrejema") || "-",
      dueDate: getParam(metadata, "DatumZapadlosti") || "-",
      serviceDate: getParam(metadata, "DatumStoritve") || "-",

      reference: getParam(metadata, "Sklic") || "-",
      title: getParam(metadata, "Naslov") || metadata.title || "-",
      type: getParam(metadata, "DOC_ROLE_TYPE") || metadata.type || "-",

      accepted: getParam(metadata, "ACCEPTED") || "-",
      acceptedTime: getParam(metadata, "ACCEPTED_TIME") || "-",

      confirmationType: getParam(metadata, "VrstaPotrditve") || "-",
      refMsgId: getParam(metadata, "RefMsgId") || "-",
      refDocId: getParam(metadata, "RefDocID") || "-",
      refDocType: getParam(metadata, "RefDocType") || "-",
      errorDescription,
      errorExplanation: findErrorExplanation(errorDescription),
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
            <a href="/dashboard" className="block rounded-lg px-4 py-3 hover:bg-slate-800">🏠 Domov</a>
            <a href="/inbox" className="block rounded-lg bg-blue-600/20 px-4 py-3 text-blue-200">📥 Prejeti računi</a>
            <a href="/acknowledgments" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📨 Povratnice</a>
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
              <a href="/inbox" className="text-sm text-blue-300 hover:text-blue-200">
                ← Nazaj
              </a>

              <h2 className="mt-4 text-4xl font-bold">
                {documentInfo?.isAcknowledgement ? "Povratnica" : "Prejeti dokument"}
              </h2>

              <p className="mt-2 text-slate-400">
                Dokument ID:{" "}
                <span className="font-semibold text-slate-200">{id}</span>
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

          {!loading && metadata && documentInfo && (
            <>
              {documentInfo.isErrorAck && documentInfo.errorDescription && (
                <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
                  <div className="text-sm font-semibold text-red-300">
                    Opis napake
                  </div>

                  <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-950/60 p-4 text-sm text-red-100">
                    {documentInfo.errorDescription}
                  </pre>
                </div>
              )}

              {documentInfo.isErrorAck && (
                <div className="mt-6 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-6">
                  <div className="text-sm font-semibold text-blue-200">
                    Razlaga napake
                  </div>

                  {documentInfo.errorExplanation ? (
                    <div
                      className="mt-3 rounded-xl bg-slate-950/60 p-4 text-sm leading-6 text-blue-100"
                      dangerouslySetInnerHTML={{
                        __html: documentInfo.errorExplanation,
                      }}
                    />
                  ) : (
                    <div className="mt-3 rounded-xl bg-slate-950/60 p-4 text-sm text-slate-300">
                      Za to napako še ni pripravljene razlage v bazi povratnic.
                    </div>
                  )}
                </div>
              )}

              <div className="mt-8 grid gap-6 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm text-slate-400">Tip dokumenta</div>

                      <h3 className="mt-1 text-3xl font-bold">
                        {documentInfo.type}
                      </h3>

                      <p className="mt-2 text-slate-400">
                        {documentInfo.title}
                      </p>
                    </div>

                    {documentInfo.isAcknowledgement ? (
                      <div className="rounded-2xl border border-slate-800 bg-slate-950 px-5 py-4 text-right">
                        <div className="text-sm text-slate-400">Status povratnice</div>
                        <div
                          className={`mt-2 inline-block rounded-full px-4 py-2 text-sm font-semibold ${getBadgeStyle(
                            documentInfo.confirmationType
                          )}`}
                        >
                          {documentInfo.confirmationType}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-green-500/20 bg-green-500/10 px-5 py-4 text-right">
                        <div className="text-sm text-green-300">
                          Znesek za plačilo
                        </div>
                        <div className="mt-1 text-2xl font-bold text-green-200">
                          {documentInfo.amount}
                        </div>
                      </div>
                    )}
                  </div>

                  {documentInfo.isAcknowledgement ? (
                    <div className="mt-8 grid gap-4 md:grid-cols-2">
                      <Info label="Vrsta potrditve" value={documentInfo.confirmationType} />
                      <Info label="Ref. MsgId" value={documentInfo.refMsgId} />
                      <Info label="Ref. DocID" value={documentInfo.refDocId} />
                      <Info label="Ref. tip dokumenta" value={documentInfo.refDocType} />
                      <Info label="Datum izdaje" value={documentInfo.issueDate} />
                      <Info label="Datum prejema" value={documentInfo.receiveDate} />
                    </div>
                  ) : (
                    <div className="mt-8 grid gap-4 md:grid-cols-2">
                      <Info label="Dobavitelj" value={documentInfo.supplierName} />
                      <Info label="Davčna dobavitelja" value={documentInfo.supplierTaxId} />
                      <Info label="Prejemnik" value={documentInfo.buyerName} />
                      <Info label="Davčna prejemnika" value={documentInfo.buyerTaxId} />
                      <Info label="Datum izdaje" value={documentInfo.issueDate} />
                      <Info label="Datum storitve" value={documentInfo.serviceDate} />
                      <Info label="Datum zapadlosti" value={documentInfo.dueDate} />
                      <Info label="Sklic" value={documentInfo.reference} />
                    </div>
                  )}
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
                      <span>{documentInfo.accepted}</span>
                    </div>

                    <div className="mt-3 flex justify-between gap-4">
                      <span className="text-slate-500">Čas sprejema</span>
                      <span className="text-right">
                        {documentInfo.acceptedTime}
                      </span>
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