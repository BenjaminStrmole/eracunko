"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "../components/AppShell";
import PaginationControls from "../components/PaginationControls";
import { useToast } from "../components/ToastProvider";
import { loadActiveCompanyWithFallback } from "../../lib/client/activeCompany";
import { getInboxData } from "../../lib/client/bizboxDataCache";

const PAGE_SIZE = 25;

function isAbortError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.name === "AbortError" || error.message.toLowerCase().includes("abort");
}

type RawParam = {
  parameterName?: string;
  parameterValue?: string;
};

type InboxDocument = {
  id: string;
  number: string;
  sender: string;
  type: string;
  status: string;
  date: string;
  raw?: {
    parameters?: {
      param?: RawParam[];
    };
    classificationname?: string;
    classificationName?: string;
  };
  parameters?: {
    param?: RawParam[];
  };
};

type ActiveCompany = {
  vatNumber?: string;
  taxId?: string;
};

function getParam(item: InboxDocument, name: string) {
  const params = item.raw?.parameters?.param || item.parameters?.param || [];
  const found = params.find((param) => param.parameterName === name);
  return found?.parameterValue || "";
}

function isAcknowledgement(item: InboxDocument) {
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

export default function InboxPage() {
  const toast = useToast();
  const loadIdRef = useRef(0);
  const [documents, setDocuments] = useState<InboxDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [raw, setRaw] = useState<unknown>(null);
  const [page, setPage] = useState(1);

  async function loadInbox() {
    const loadId = ++loadIdRef.current;
    setLoading(true);
    setError("");

    try {
      const activeCompany = (await loadActiveCompanyWithFallback()) as ActiveCompany | null;
      if (loadId !== loadIdRef.current) return;

      const taxNumber = activeCompany?.vatNumber || activeCompany?.taxId || "";
      const applyData = (data: {
        success: boolean;
        documents?: InboxDocument[];
        raw?: unknown;
        message?: string;
      }) => {
        if (loadId !== loadIdRef.current) return;
        if (!data.success) {
        const message = data.message || "Napaka pri pridobivanju inboxa.";
        setError(message);
        toast.error("Dokumentov ni bilo mogoče naložiti", message);
        setRaw(data.raw || data);
        return;
      }

      setDocuments(data.documents || []);
      setRaw(data.raw);
      };

      const result = await getInboxData<InboxDocument>({
        taxNumber,
        timeoutMs: 90_000,
      });

      applyData(result.data);

      if (result.fromCache && result.refresh) {
        setLoading(false);
        result.refresh
          .then((freshData) => {
            if (freshData) applyData(freshData);
          })
          .catch(() => {});
      }
    } catch (err) {
      if (loadId !== loadIdRef.current) return;
      if (isAbortError(err)) return;
      const message =
        err instanceof Error ? err.message : "Napaka pri pridobivanju inboxa.";
      setError(message);
      toast.error("Dokumentov ni bilo mogoče naložiti", message);
    } finally {
      if (loadId === loadIdRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      loadInbox();
    });

    const handleActiveCompanyChanged = () => {
      setPage(1);
      loadInbox();
    };

    window.addEventListener("active-company-changed", handleActiveCompanyChanged);

    return () => {
      window.removeEventListener("active-company-changed", handleActiveCompanyChanged);
    };
  }, []);

  const incomingDocuments = useMemo(
    () => documents.filter((doc) => !isAcknowledgement(doc)),
    [documents]
  );
  const totalPages = Math.max(1, Math.ceil(incomingDocuments.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedDocuments = incomingDocuments.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <AppShell>
      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="status-pill mb-4 inline-flex">Vhodni dokumenti</div>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Prejeti računi
          </h1>
          <p className="app-muted mt-3 max-w-2xl">
            Pregled prejetih računov iz bizBox DEMO okolja za izbrano podjetje.
          </p>
        </div>

        <button
          onClick={loadInbox}
          disabled={loading}
          className="secondary-button h-12 px-5 disabled:opacity-60"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {loading ? "Osvežujem..." : "Osveži"}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-500">
          {error}
        </div>
      )}

      <section className="solid-panel overflow-hidden rounded-[1.75rem]">
        <div className="overflow-x-auto">
          <div className="min-w-[840px]">
            <div className="grid grid-cols-5 border-b border-[var(--app-border)] px-6 py-4 text-sm app-muted">
              <div>Številka</div>
              <div>Pošiljatelj</div>
              <div>Tip</div>
              <div>Status</div>
              <div>Datum</div>
            </div>

            {loading && (
              <div className="app-muted px-6 py-8">
                Nalagam dokumente iz bizBox ...
              </div>
            )}

            {!loading && incomingDocuments.length === 0 && !error && (
              <div className="app-muted px-6 py-8">
                Ni prejetih dokumentov ali pa endpoint vrača drugačno strukturo.
              </div>
            )}

            {!loading &&
              pagedDocuments.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/inbox/${doc.id}`}
                  className="grid grid-cols-5 border-b border-[var(--app-border)] px-6 py-4 last:border-b-0 hover:bg-[var(--app-soft)]"
                >
                  <div className="font-medium">{doc.number}</div>
                  <div className="app-muted">{doc.sender}</div>
                  <div className="app-muted">{doc.type}</div>
                  <div>
                    <span className="rounded-full bg-[var(--app-soft)] px-3 py-1 text-sm font-semibold text-[var(--app-primary-strong)]">
                      {doc.status}
                    </span>
                  </div>
                  <div className="app-muted">{doc.date}</div>
                </Link>
              ))}
          </div>
        </div>

        {!loading && incomingDocuments.length > 0 && (
          <PaginationControls
            page={currentPage}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
            totalItems={incomingDocuments.length}
            onPageChange={setPage}
          />
        )}
      </section>

      {raw !== null && (
        <details className="solid-panel mt-8 rounded-[1.5rem] p-5">
          <summary className="cursor-pointer font-semibold text-[var(--app-primary-strong)]">
            Debug raw response
          </summary>

          <pre className="mt-4 max-h-[500px] overflow-auto rounded-2xl bg-slate-950 p-4 text-sm text-slate-200">
            {typeof raw === "string" ? raw : JSON.stringify(raw, null, 2)}
          </pre>
        </details>
      )}
    </AppShell>
  );
}
