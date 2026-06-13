"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import PaginationControls from "../components/PaginationControls";
import { useToast } from "../components/ToastProvider";

const PAGE_SIZE = 25;

type DocumentParam = {
  parameterName?: string;
  parameterValue?: string;
};

type DocumentMetadata = {
  title?: string;
  type?: string;
  classificationName?: string;
  parameters?: {
    param?: DocumentParam[];
  };
};

type DocumentItem = {
  id: string;
  number: string;
  sender: string;
  type: string;
  status: string;
  date: string;
  raw?: DocumentMetadata & {
    classificationname?: string;
    externalid?: string;
    filename?: string;
  };
  metadata?: DocumentMetadata;
  parameters?: {
    param?: DocumentParam[];
  };
  acknowledgement?: {
    confirmationType?: string;
    refMsgId?: string;
    issueDate?: string;
    description?: string;
    roleType?: string;
    isError?: boolean;
  };
};

type FilterType = "all" | "error";

function getParam(item: DocumentItem, name: string) {
  const params =
    item?.metadata?.parameters?.param ||
    item?.raw?.parameters?.param ||
    item?.parameters?.param ||
    [];

  const found = params.find((param) => param.parameterName === name);
  return found?.parameterValue || "";
}

function cleanErrorText(value: string) {
  return value
    .replace("[ERROR:", "")
    .replace("[ERROR", "")
    .replace("]", "")
    .trim();
}

function getTitle(item: DocumentItem) {
  return String(
    item.metadata?.title ||
      item.raw?.title ||
      item.number ||
      item.raw?.externalid ||
      item.raw?.filename ||
      "-"
  );
}

function getConfirmationType(item: DocumentItem) {
  return (
    item.acknowledgement?.confirmationType ||
    getParam(item, "VrstaPotrditve") ||
    getTitle(item)
  );
}

function getDescription(item: DocumentItem) {
  return item.acknowledgement?.description || getParam(item, "Opis") || "";
}

function isAcknowledgement(item: DocumentItem) {
  const actualType = getParam(item, "ACTUAL_TYPE");
  const roleType =
    item.acknowledgement?.roleType || getParam(item, "DOC_ROLE_TYPE");
  const classification =
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

function isErrorAck(item: DocumentItem) {
  if (item.acknowledgement?.isError) return true;

  const confirmation = getConfirmationType(item).toLowerCase();
  const title = getTitle(item).toLowerCase();
  const description = getDescription(item).toLowerCase();

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

  if (text.startsWith("12")) return "bg-emerald-500/10 text-emerald-500";
  if (text.startsWith("29")) return "bg-emerald-500/10 text-emerald-500";
  if (text.startsWith("27")) return "bg-red-500/10 text-red-500";
  if (text.includes("-99")) return "bg-red-500/10 text-red-500";
  if (text.startsWith("43")) return "bg-amber-500/10 text-amber-500";

  return "bg-[var(--app-soft)] text-[var(--app-primary-strong)]";
}

export default function AcknowledgementsPage() {
  const toast = useToast();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [scanLimit, setScanLimit] = useState(25);
  const [enrichedCount, setEnrichedCount] = useState(0);
  const [page, setPage] = useState(1);

  async function loadDocuments(limit = scanLimit) {
    setLoading(true);
    setError("");
    setEnrichedCount(0);

    try {
      const activeCompany = JSON.parse(
        localStorage.getItem("activeCompany") || "null"
      );

      const taxNumber = activeCompany?.vatNumber || activeCompany?.taxId || "";

      const response = await fetch(
        `/api/bizbox/inbox?taxNumber=${encodeURIComponent(
          taxNumber
        )}&includeMetadata=true&limit=${limit}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!data.success) {
        const message = data.message || "Napaka pri pridobivanju povratnic.";
        setError(message);
        toast.error("Povratnic ni bilo mogoče naložiti", message);
        return;
      }

      const list: DocumentItem[] = data.documents || [];
      const onlyAcks = list.filter(isAcknowledgement);

      setDocuments(onlyAcks);
      setEnrichedCount(data.metadata?.enrichedCount || 0);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Napaka pri pridobivanju povratnic.";
      setError(message);
      toast.error("Povratnic ni bilo mogoče naložiti", message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");

    queueMicrotask(() => {
      if (status === "error") {
        setFilter("error");
      }

      loadDocuments();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allAcknowledgements = useMemo(
    () => documents.filter(isAcknowledgement),
    [documents]
  );

  const errorAcknowledgements = useMemo(
    () => allAcknowledgements.filter(isErrorAck),
    [allAcknowledgements]
  );

  const filteredAcknowledgements = useMemo(() => {
    const source =
      filter === "error" ? errorAcknowledgements : allAcknowledgements;

    return source.slice(0, scanLimit);
  }, [allAcknowledgements, errorAcknowledgements, filter, scanLimit]);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredAcknowledgements.length / PAGE_SIZE)
  );
  const currentPage = Math.min(page, totalPages);
  const displayedAcknowledgements = filteredAcknowledgements.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <AppShell>
          <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="status-pill mb-4 inline-flex">Status dostave</div>
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                Povratnice
              </h1>
              <p className="app-muted mt-3 max-w-2xl">
                Pregled povratnic za izbrano aktivno podjetje.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={scanLimit}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setScanLimit(value);
                  setPage(1);
                  loadDocuments(value);
                }}
                className="field-input h-12 w-44 text-sm"
              >
                <option value={25}>25 rezultatov</option>
                <option value={50}>50 rezultatov</option>
                <option value={75}>75 rezultatov</option>
                <option value={100}>100 rezultatov</option>
                <option value={150}>150 rezultatov</option>
                <option value={300}>300 rezultatov</option>
              </select>

              <button
                onClick={() => loadDocuments(scanLimit)}
                disabled={loading}
                className="secondary-button h-12 px-5 disabled:opacity-60"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {loading ? "Osvežujem..." : "Osveži"}
              </button>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <button
              onClick={() => {
                setFilter("all");
                setPage(1);
              }}
              className={`rounded-full px-5 py-2 text-sm font-semibold ${
                filter === "all"
                  ? "bg-[var(--app-primary)] text-white"
                  : "border border-[var(--app-border)] app-muted hover:bg-[var(--app-soft)]"
              }`}
            >
              Vse povratnice ({allAcknowledgements.length})
            </button>

            <button
              onClick={() => {
                setFilter("error");
                setPage(1);
              }}
              className={`rounded-full px-5 py-2 text-sm font-semibold ${
                filter === "error"
                  ? "bg-red-600 text-white"
                  : "border border-red-500/30 text-red-500 hover:bg-red-500/10"
              }`}
            >
              Napake ({errorAcknowledgements.length})
            </button>
          </div>

          {error && (
            <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-500">
              {error}
            </div>
          )}

          <div className="solid-panel mt-8 overflow-hidden rounded-[1.75rem]">
            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-6 border-b border-[var(--app-border)] px-6 py-4 text-sm app-muted">
                  <div>Dokument</div>
                  <div>Vrsta</div>
                  <div>Ref. sporočilo</div>
                  <div>Status</div>
                  <div>Datum</div>
                  <div>Akcija</div>
                </div>

                {loading && (
                  <div className="app-muted px-6 py-8">
                    Nalagam povratnice in metadata ...
                  </div>
                )}

                {!loading && displayedAcknowledgements.length === 0 && !error && (
                  <div className="app-muted px-6 py-8">
                    {filter === "error"
                      ? "Ni povratnic z napako med trenutno pregledanimi rezultati."
                      : "Ni povratnic za izbrano podjetje."}
                  </div>
                )}

                {!loading &&
                  displayedAcknowledgements.map((doc) => {
                    const confirmationType = getConfirmationType(doc);
                    const refMsgId =
                      doc.acknowledgement?.refMsgId ||
                      getParam(doc, "RefMsgId") ||
                      "-";
                    const issueDate =
                      doc.acknowledgement?.issueDate ||
                      getParam(doc, "DatumIzdaje") ||
                      doc.date;
                    const roleType =
                      doc.acknowledgement?.roleType ||
                      getParam(doc, "DOC_ROLE_TYPE") ||
                      doc.metadata?.type ||
                      doc.type;
                    const description = getDescription(doc);

                    return (
                      <Link
                        key={doc.id}
                        href={`/inbox/${doc.id}`}
                        className="grid grid-cols-6 border-b border-[var(--app-border)] px-6 py-4 last:border-b-0 hover:bg-[var(--app-soft)]"
                      >
                        <div className="font-medium">{getTitle(doc)}</div>
                        <div className="app-muted">{roleType}</div>
                        <div className="app-muted">{refMsgId}</div>
                        <div>
                          <span
                            className={`rounded-full px-3 py-1 text-sm font-semibold ${getBadgeStyle(
                              confirmationType
                            )}`}
                          >
                            {confirmationType}
                          </span>

                          {description && isErrorAck(doc) && (
                            <div className="mt-2 max-w-xs truncate text-xs text-red-500">
                              {cleanErrorText(description)}
                            </div>
                          )}
                        </div>
                        <div className="app-muted">{issueDate}</div>
                        <div className="text-[var(--app-primary-strong)]">Odpri →</div>
                      </Link>
                    );
                  })}
              </div>
            </div>

            {!loading && filteredAcknowledgements.length > 0 && (
              <PaginationControls
                page={currentPage}
                totalPages={totalPages}
                pageSize={PAGE_SIZE}
                totalItems={filteredAcknowledgements.length}
                onPageChange={setPage}
              />
            )}
          </div>

          <div className="app-muted mt-4 text-sm">
            Metadata je pridobljena na backendu za prvih{" "}
            {Math.min(enrichedCount, scanLimit)} dokumentov.
          </div>
    </AppShell>
  );
}
