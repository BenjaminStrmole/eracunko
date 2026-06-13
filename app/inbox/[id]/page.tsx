"use client";

import { Download, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import errorPatterns from "../../../povratnice_folder_view.json";
import AppShell from "../../components/AppShell";
import { useToast } from "../../components/ToastProvider";

type ErrorPattern = {
  pattern: string;
  response: string;
};

type MetadataParam = {
  parameterName?: string;
  parameterValue?: string;
};

type DocumentMetadata = {
  organization?: string;
  title?: string;
  type?: string;
  classificationName?: string;
  parameters?: {
    param?: MetadataParam[];
  };
};

function getParam(metadata: DocumentMetadata | null, name: string) {
  const params = metadata?.parameters?.param || [];
  const found = params.find((item) => item.parameterName === name);
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

function isAcknowledgement(metadata: DocumentMetadata) {
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

function isOutgoingDocument(metadata: DocumentMetadata) {
  const docRole = getParam(metadata, "DOC_ROLE");
  const roleType = getParam(metadata, "DOC_ROLE_TYPE");
  const classification = metadata?.classificationName || "";

  const text = `${docRole} ${roleType} ${classification}`.toLowerCase();

  return (
    text.includes("izhodni") ||
    text.includes("poslan") ||
    text.includes("out")
  );
}

function isErrorAcknowledgement(metadata: DocumentMetadata) {
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
  const toast = useToast();
  const params = useParams();
  const id = String(params.id);

  const [metadata, setMetadata] = useState<DocumentMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMetadata = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/bizbox/document/${id}/metadata`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!data.success) {
        const message = data.message || "Napaka pri pridobivanju metadata.";
        setError(message);
        toast.error("Detajla dokumenta ni bilo mogoče naložiti", message);
        setMetadata(data.raw || data);
        return;
      }

      setMetadata(data.metadata as DocumentMetadata);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Napaka pri pridobivanju metadata.";
      setError(message);
      toast.error("Detajla dokumenta ni bilo mogoče naložiti", message);
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    queueMicrotask(() => {
      loadMetadata();
    });
  }, [loadMetadata]);

  const documentInfo = useMemo(() => {
    if (!metadata) return null;

    const acknowledgement = isAcknowledgement(metadata);
    const outgoing = isOutgoingDocument(metadata);
    const errorAck = isErrorAcknowledgement(metadata);
    const errorDescription = cleanErrorText(getParam(metadata, "Opis") || "");

    return {
      isAcknowledgement: acknowledgement,
      isOutgoing: outgoing,
      isIncoming: !outgoing,
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

  const backHref = documentInfo?.isAcknowledgement
    ? "/acknowledgments"
    : documentInfo?.isOutgoing
    ? "/sent"
    : "/inbox";

  const pageTitle = documentInfo?.isAcknowledgement
    ? "Povratnica"
    : documentInfo?.isOutgoing
    ? "Poslani dokument"
    : "Prejeti dokument";

  return (
    <AppShell>
          <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <Link
                href={backHref}
                className="text-sm font-semibold text-[var(--app-primary-strong)]"
              >
                Nazaj
              </Link>
              <div className="status-pill mt-5 mb-4 inline-flex">
                Detajl dokumenta
              </div>
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                {pageTitle}
              </h1>

              <p className="app-muted mt-3 max-w-2xl">
                Dokument ID:{" "}
                <span className="font-semibold text-[var(--foreground)]">{id}</span>
              </p>
            </div>

            <Link
              href={`/api/bizbox/document/${id}`}
              className="primary-button h-12 px-6"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Prenesi ZIP
            </Link>
          </div>

          {loading && (
            <div className="solid-panel rounded-[1.75rem] p-6 app-muted">
              Nalagam podatke dokumenta ...
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-500">
              {error}
            </div>
          )}

          {!loading && metadata && documentInfo && (
            <>
              {documentInfo.isErrorAck && documentInfo.errorDescription && (
                <div className="rounded-[1.75rem] border border-red-500/30 bg-red-500/10 p-6">
                  <div className="text-sm font-semibold text-red-500">
                    Opis napake
                  </div>

                  <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-sm text-red-100">
                    {documentInfo.errorDescription}
                  </pre>
                </div>
              )}

              {documentInfo.isErrorAck && (
                <div className="mt-6 rounded-[1.75rem] border border-[var(--app-primary)]/30 bg-[var(--app-soft)] p-6">
                  <div className="text-sm font-semibold text-[var(--app-primary-strong)]">
                    Razlaga napake
                  </div>

                  {documentInfo.errorExplanation ? (
                    <div
                      className="app-muted mt-3 rounded-2xl bg-[var(--app-surface)] p-4 text-sm leading-6"
                      dangerouslySetInnerHTML={{
                        __html: documentInfo.errorExplanation,
                      }}
                    />
                  ) : (
                    <div className="app-muted mt-3 rounded-2xl bg-[var(--app-surface)] p-4 text-sm">
                      Za to napako še ni pripravljene razlage v bazi povratnic.
                    </div>
                  )}
                </div>
              )}

              <div className="mt-8 grid gap-6 lg:grid-cols-3">
                <div className="solid-panel rounded-[1.75rem] p-6 lg:col-span-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="app-muted text-sm">Tip dokumenta</div>

                      <h2 className="mt-1 text-3xl font-semibold">
                        {documentInfo.type}
                      </h2>

                      <p className="app-muted mt-2">
                        {documentInfo.title}
                      </p>
                    </div>

                    {documentInfo.isAcknowledgement ? (
                      <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-soft)] px-5 py-4 text-right">
                        <div className="app-muted text-sm">Status povratnice</div>
                        <div
                          className={`mt-2 inline-block rounded-full px-4 py-2 text-sm font-semibold ${getBadgeStyle(
                            documentInfo.confirmationType
                          )}`}
                        >
                          {documentInfo.confirmationType}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-right">
                        <div className="text-sm text-emerald-500">
                          Znesek za plačilo
                        </div>
                        <div className="mt-1 text-2xl font-semibold text-emerald-500">
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
                      <Info
                        label={documentInfo.isOutgoing ? "Izdajatelj" : "Dobavitelj"}
                        value={documentInfo.supplierName}
                      />
                      <Info
                        label={documentInfo.isOutgoing ? "Davčna izdajatelja" : "Davčna dobavitelja"}
                        value={documentInfo.supplierTaxId}
                      />
                      <Info label="Prejemnik" value={documentInfo.buyerName} />
                      <Info label="Davčna prejemnika" value={documentInfo.buyerTaxId} />
                      <Info label="Datum izdaje" value={documentInfo.issueDate} />
                      <Info label="Datum storitve" value={documentInfo.serviceDate} />
                      <Info label="Datum zapadlosti" value={documentInfo.dueDate} />
                      <Info label="Sklic" value={documentInfo.reference} />
                    </div>
                  )}
                </div>

                <aside className="glass-panel rounded-[1.75rem] p-6">
                  <h2 className="text-xl font-semibold">Akcije</h2>

                  <div className="mt-6 space-y-3">
                    <Link
                      href={`/api/bizbox/document/${id}`}
                      className="primary-button h-12 w-full px-5"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Prenesi originalni ZIP
                    </Link>

                    <button
                      onClick={loadMetadata}
                      className="secondary-button h-12 w-full px-5"
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      Osveži metadata
                    </button>
                  </div>

                  <div className="mt-6 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 text-sm">
                    <div className="flex justify-between">
                      <span className="app-muted">Sprejeto</span>
                      <span>{documentInfo.accepted}</span>
                    </div>

                    <div className="mt-3 flex justify-between gap-4">
                      <span className="app-muted">Čas sprejema</span>
                      <span className="text-right">
                        {documentInfo.acceptedTime}
                      </span>
                    </div>
                  </div>
                </aside>
              </div>

              <details className="solid-panel mt-8 rounded-[1.75rem] p-5">
                <summary className="cursor-pointer font-semibold text-[var(--app-primary-strong)]">
                  Raw metadata
                </summary>

                <pre className="mt-4 max-h-[500px] overflow-auto rounded-2xl bg-slate-950 p-4 text-sm text-slate-200">
                  {typeof metadata === "string"
                    ? metadata
                    : JSON.stringify(metadata, null, 2)}
                </pre>
              </details>
            </>
          )}
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
      <div className="app-muted text-sm">{label}</div>
      <div className="mt-1 break-words font-semibold">
        {value || "-"}
      </div>
    </div>
  );
}
