"use client";

import {
  ArrowRight,
  FileCode2,
  FilePlus2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";

type Customer = {
  name: string;
  vatNumber: string;
  status: "READY" | "NOT_READY";
  eLocation: string;
  eAddress?: string;
  address?: string;
  postCode?: string;
  city?: string;
  country?: string;
  format: string;
  isFavorite?: boolean;
};

type ActiveCompany = {
  name?: string;
  vatNumber?: string;
  taxId?: string;
  eLocation?: string;
  eAddress?: string;
  address?: string;
  postCode?: string;
  city?: string;
  country?: string;
};

type InvoiceLine = {
  id: number;
  description: string;
  quantity: number;
  price: number;
  vatRate: number;
  unit: string;
  vatCategory: string;
};

type CompanySettings = {
  iban?: string;
  bic?: string;
  defaultDueDays?: string;
  invoicePrefix?: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function escapeXml(value: string | number | undefined | null) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeVat(value: string) {
  return value.replace(/\s/g, "").toUpperCase();
}

function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const saved = safeJsonParse<any[]>(localStorage.getItem("invoices"), []);
  const drafts = safeJsonParse<any[]>(localStorage.getItem("drafts"), []);
  const settings = safeJsonParse<CompanySettings>(
    localStorage.getItem("companySettings"),
    {}
  );

  const prefix = settings.invoicePrefix?.trim();
  const yearPrefix = prefix ? `${prefix}-${year}-` : `${year}-`;
  const all = [...saved, ...drafts];

  const sameYear = all.filter((invoice) =>
    String(invoice.number || "").startsWith(yearPrefix)
  );

  return `${yearPrefix}${String(sameYear.length + 1).padStart(3, "0")}`;
}

export default function NewInvoicePage() {
  const [activeCompany, setActiveCompany] = useState<ActiveCompany | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [buyer, setBuyer] = useState<Customer | null>(null);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [serviceDate, setServiceDate] = useState(today());
  const [dueDate, setDueDate] = useState(addDays(15));

  const [currency] = useState("EUR");
  const [documentType, setDocumentType] = useState("380");
  const [businessProcess, setBusinessProcess] = useState("P1");
  const [paymentMeansCode, setPaymentMeansCode] = useState("30");
  const [purposeCode, setPurposeCode] = useState("OTHR");
  const [bankAccount, setBankAccount] = useState("SI56 0000 0000 0000 000");
  const [bankBic, setBankBic] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const [lines, setLines] = useState<InvoiceLine[]>([
    {
      id: 1,
      description: "Svetovanje",
      quantity: 1,
      price: 100,
      vatRate: 22,
      unit: "HUR",
      vatCategory: "S",
    },
  ]);

  const [toast, setToast] = useState("");

  useEffect(() => {
    const company = safeJsonParse<ActiveCompany | null>(
      localStorage.getItem("activeCompany"),
      null
    );
    const savedCustomers = safeJsonParse<Customer[]>(
      localStorage.getItem("customers"),
      []
    );
    const settings = safeJsonParse<CompanySettings>(
      localStorage.getItem("companySettings"),
      {}
    );

    const params = new URLSearchParams(window.location.search);
    const vat = params.get("vat");

    queueMicrotask(() => {
      const number = generateInvoiceNumber();

      setActiveCompany(company);
      setCustomers(savedCustomers);
      setInvoiceNumber(number);
      setReference(`SI00-${number.replaceAll("-", "")}`);
      setBankAccount(settings.iban || "SI56 0000 0000 0000 000");
      setBankBic(settings.bic || "");

      if (settings.defaultDueDays) {
        setDueDate(addDays(Number(settings.defaultDueDays) || 15));
      }

      if (vat) {
        const selected = savedCustomers.find(
          (customer) => normalizeVat(customer.vatNumber) === normalizeVat(vat)
        );

        if (selected) setBuyer(selected);
      }
    });
  }, []);

  const totals = useMemo(() => {
    const net = lines.reduce(
      (sum, line) => sum + Number(line.quantity || 0) * Number(line.price || 0),
      0
    );

    const vat = lines.reduce((sum, line) => {
      const lineNet = Number(line.quantity || 0) * Number(line.price || 0);
      return sum + lineNet * (Number(line.vatRate || 0) / 100);
    }, 0);

    return {
      net,
      vat,
      gross: net + vat,
    };
  }, [lines]);

  const xmlPreview = useMemo(() => {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice>
  <Document>
    <Type>${escapeXml(documentType)}</Type>
    <Number>${escapeXml(invoiceNumber)}</Number>
    <IssueDate>${escapeXml(issueDate)}</IssueDate>
    <ServiceDate>${escapeXml(serviceDate)}</ServiceDate>
    <DueDate>${escapeXml(dueDate)}</DueDate>
    <Currency>${escapeXml(currency)}</Currency>
    <BusinessProcess>${escapeXml(businessProcess)}</BusinessProcess>
  </Document>

  <Seller>
    <Name>${escapeXml(activeCompany?.name)}</Name>
    <VatNumber>${escapeXml(activeCompany?.vatNumber || activeCompany?.taxId)}</VatNumber>
    <ELocation>${escapeXml(activeCompany?.eLocation)}</ELocation>
    <EAddress>${escapeXml(activeCompany?.eAddress)}</EAddress>
  </Seller>

  <Buyer>
    <Name>${escapeXml(buyer?.name)}</Name>
    <VatNumber>${escapeXml(buyer?.vatNumber)}</VatNumber>
    <ELocation>${escapeXml(buyer?.eLocation)}</ELocation>
    <EAddress>${escapeXml(buyer?.eAddress)}</EAddress>
  </Buyer>

  <Payment>
    <PaymentMeansCode>${escapeXml(paymentMeansCode)}</PaymentMeansCode>
    <PurposeCode>${escapeXml(purposeCode)}</PurposeCode>
    <IBAN>${escapeXml(bankAccount)}</IBAN>
    <BIC>${escapeXml(bankBic)}</BIC>
    <Reference>${escapeXml(reference)}</Reference>
  </Payment>

  <Lines>
${lines
  .map(
    (line, index) => `    <Line>
      <LineNumber>${index + 1}</LineNumber>
      <Description>${escapeXml(line.description)}</Description>
      <Quantity>${escapeXml(line.quantity)}</Quantity>
      <Unit>${escapeXml(line.unit)}</Unit>
      <NetPrice>${escapeXml(line.price)}</NetPrice>
      <VatRate>${escapeXml(line.vatRate)}</VatRate>
      <VatCategory>${escapeXml(line.vatCategory)}</VatCategory>
    </Line>`
  )
  .join("\n")}
  </Lines>

  <Totals>
    <NetAmount>${totals.net.toFixed(2)}</NetAmount>
    <VatAmount>${totals.vat.toFixed(2)}</VatAmount>
    <PayableAmount>${totals.gross.toFixed(2)}</PayableAmount>
  </Totals>
</Invoice>`;
  }, [
    activeCompany,
    buyer,
    businessProcess,
    currency,
    documentType,
    dueDate,
    issueDate,
    serviceDate,
    invoiceNumber,
    paymentMeansCode,
    purposeCode,
    bankAccount,
    bankBic,
    reference,
    lines,
    totals,
  ]);

  function updateLine(id: number, patch: Partial<InvoiceLine>) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line))
    );
  }

  function addLine() {
    setLines((current) => [
      ...current,
      {
        id: Date.now(),
        description: "",
        quantity: 1,
        price: 0,
        vatRate: 22,
        unit: "HUR",
        vatCategory: "S",
      },
    ]);
  }

  function removeLine(id: number) {
    setLines((current) =>
      current.length === 1 ? current : current.filter((line) => line.id !== id)
    );
  }

  function buildInvoice() {
    return {
      id: Date.now(),
      number: invoiceNumber,
      issueDate,
      serviceDate,
      dueDate,
      currency,
      documentType,
      businessProcess,
      note,
      seller: {
        name: activeCompany?.name || "",
        vat: activeCompany?.vatNumber || activeCompany?.taxId || "",
        address: activeCompany?.address || "",
        eLocation: activeCompany?.eLocation || "",
        eAddress: activeCompany?.eAddress || "",
      },
      buyer: {
        name: buyer?.name || "",
        vat: buyer?.vatNumber || "",
        address: [buyer?.address, buyer?.postCode, buyer?.city]
          .filter(Boolean)
          .join(", "),
        eLocation: buyer?.eLocation || "",
        eAddress: buyer?.eAddress || "",
      },
      payment: {
        paymentMeansCode,
        purposeCode,
        bankAccount,
        bankBic,
        reference,
      },
      lines,
      totals,
      xmlPreview,
      createdAt: new Date().toISOString(),
    };
  }

  function saveDraft() {
    if (!buyer) {
      setToast("Najprej izberi kupca.");
      return;
    }

    const drafts = safeJsonParse<any[]>(localStorage.getItem("drafts"), []);
    const invoice = buildInvoice();

    localStorage.setItem("drafts", JSON.stringify([invoice, ...drafts]));
    setToast("Osnutek računa je shranjen.");
  }

  function continueToPreview() {
    if (!activeCompany) {
      setToast("Najprej izberi aktivno podjetje v zgornjem izbirniku.");
      return;
    }

    if (!buyer) {
      setToast("Najprej izberi kupca.");
      return;
    }

    const invoice = buildInvoice();
    localStorage.setItem("eracunko_current_invoice", JSON.stringify(invoice));
    window.location.href = "/invoices/preview";
  }

  return (
    <AppShell>
      {toast && (
        <div className="glass-panel fixed right-5 top-5 z-50 max-w-md rounded-2xl px-5 py-4 text-sm">
          {toast}
        </div>
      )}

      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="status-pill mb-4 inline-flex">eSLOG 2.0</div>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Nov račun
          </h1>
          <p className="app-muted mt-3 max-w-2xl">
            Pripravi račun, preveri ključne podatke za XML in nadaljuj na
            predogled pred pošiljanjem.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={saveDraft} className="secondary-button h-12 px-6">
            <Save className="h-4 w-4" aria-hidden="true" />
            Shrani osnutek
          </button>

          <button onClick={continueToPreview} className="primary-button h-12 px-6">
            Nadaljuj
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {!activeCompany && (
        <section className="mb-8 rounded-[1.75rem] border border-amber-500/25 bg-amber-500/10 p-5 text-amber-500">
          Aktivno podjetje ni izbrano. Izberi ga v zgornjem izbirniku podjetij.
        </section>
      )}

      <div className="grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-8">
          <section className="solid-panel rounded-[1.75rem] p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Osnovni podatki</h2>
                <p className="app-muted mt-1 text-sm">
                  Številka, datumi in poslovni proces dokumenta.
                </p>
              </div>
              <FilePlus2 className="h-5 w-5 text-[var(--app-primary)]" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Številka računa">
                <input
                  value={invoiceNumber}
                  onChange={(event) => setInvoiceNumber(event.target.value)}
                  className="field-input"
                />
              </Field>

              <Field label="Tip dokumenta">
                <select
                  value={documentType}
                  onChange={(event) => setDocumentType(event.target.value)}
                  className="field-input"
                >
                  <option value="380">380 - Račun</option>
                  <option value="381">381 - Dobropis</option>
                  <option value="383">383 - Breme</option>
                </select>
              </Field>

              <Field label="Datum izdaje">
                <input
                  type="date"
                  value={issueDate}
                  onChange={(event) => setIssueDate(event.target.value)}
                  className="field-input"
                />
              </Field>

              <Field label="Datum opravljene storitve">
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(event) => setServiceDate(event.target.value)}
                  className="field-input"
                />
              </Field>

              <Field label="Rok plačila">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="field-input"
                />
              </Field>

              <Field label="Poslovni proces">
                <select
                  value={businessProcess}
                  onChange={(event) => setBusinessProcess(event.target.value)}
                  className="field-input"
                >
                  <option value="P1">P1 - Osnovni račun</option>
                  <option value="P2">P2 - Naročilnica</option>
                  <option value="P3">P3 - Pogodba</option>
                </select>
              </Field>
            </div>
          </section>

          <section className="solid-panel rounded-[1.75rem] p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Kupec</h2>
                <p className="app-muted mt-1 text-sm">
                  Izberi shranjeno stranko iz eImenika.
                </p>
              </div>
              <Link
                href="/customers/new"
                className="text-sm font-semibold text-[var(--app-primary-strong)]"
              >
                Dodaj stranko
              </Link>
            </div>

            <select
              value={buyer?.vatNumber || ""}
              onChange={(event) => {
                const selected = customers.find(
                  (customer) => customer.vatNumber === event.target.value
                );
                setBuyer(selected || null);
              }}
              className="field-input"
            >
              <option value="">Izberi kupca...</option>
              {customers.map((customer) => (
                <option key={customer.vatNumber} value={customer.vatNumber}>
                  {customer.name} - {customer.vatNumber}
                </option>
              ))}
            </select>

            {buyer && (
              <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                <Info label="Naziv" value={buyer.name} />
                <Info label="Davčna" value={buyer.vatNumber} />
                <Info label="eLokacija" value={buyer.eLocation} />
                <Info label="eAddress" value={buyer.eAddress || "-"} />
              </div>
            )}
          </section>

          <section className="solid-panel rounded-[1.75rem] p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Postavke</h2>
                <p className="app-muted mt-1 text-sm">
                  Neto cena, količina, DDV stopnja in DDV kategorija.
                </p>
              </div>

              <button onClick={addLine} className="secondary-button h-10 px-4">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Dodaj
              </button>
            </div>

            <div className="space-y-4">
              {lines.map((line, index) => (
                <div
                  key={line.id}
                  className="rounded-[1.25rem] border border-[var(--app-border)] bg-[var(--app-surface)] p-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="status-pill">Postavka {index + 1}</span>
                    <button
                      onClick={() => removeLine(line.id)}
                      className="rounded-xl border border-red-500/25 px-3 py-2 text-red-500 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-6">
                    <div className="md:col-span-2">
                      <Field label="Opis">
                        <input
                          value={line.description}
                          onChange={(event) =>
                            updateLine(line.id, {
                              description: event.target.value,
                            })
                          }
                          className="field-input"
                        />
                      </Field>
                    </div>

                    <Field label="Količina">
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(line.id, {
                            quantity: Number(event.target.value),
                          })
                        }
                        className="field-input"
                      />
                    </Field>

                    <Field label="Enota">
                      <input
                        value={line.unit}
                        onChange={(event) =>
                          updateLine(line.id, { unit: event.target.value })
                        }
                        className="field-input"
                      />
                    </Field>

                    <Field label="Cena">
                      <input
                        type="number"
                        value={line.price}
                        onChange={(event) =>
                          updateLine(line.id, {
                            price: Number(event.target.value),
                          })
                        }
                        className="field-input"
                      />
                    </Field>

                    <Field label="DDV %">
                      <input
                        type="number"
                        value={line.vatRate}
                        onChange={(event) =>
                          updateLine(line.id, {
                            vatRate: Number(event.target.value),
                          })
                        }
                        className="field-input"
                      />
                    </Field>
                  </div>

                  <div className="mt-4 max-w-xs">
                    <Field label="DDV kategorija">
                      <select
                        value={line.vatCategory}
                        onChange={(event) =>
                          updateLine(line.id, {
                            vatCategory: event.target.value,
                          })
                        }
                        className="field-input"
                      >
                        <option value="S">S - Standardna stopnja</option>
                        <option value="Z">Z - Ničelna stopnja</option>
                        <option value="E">E - Oproščeno</option>
                        <option value="AE">AE - Reverse charge</option>
                      </select>
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="solid-panel rounded-[1.75rem] p-6">
            <h2 className="text-xl font-semibold">Plačilo</h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Način plačila">
                <select
                  value={paymentMeansCode}
                  onChange={(event) => setPaymentMeansCode(event.target.value)}
                  className="field-input"
                >
                  <option value="30">30 - Kreditno nakazilo</option>
                  <option value="58">58 - SEPA nakazilo</option>
                  <option value="10">10 - Gotovina</option>
                </select>
              </Field>

              <Field label="Koda namena">
                <input
                  value={purposeCode}
                  onChange={(event) => setPurposeCode(event.target.value)}
                  className="field-input"
                />
              </Field>

              <Field label="IBAN">
                <input
                  value={bankAccount}
                  onChange={(event) => setBankAccount(event.target.value)}
                  className="field-input"
                />
              </Field>

              <Field label="BIC">
                <input
                  value={bankBic}
                  onChange={(event) => setBankBic(event.target.value)}
                  className="field-input"
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="Sklic">
                  <input
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    className="field-input"
                  />
                </Field>
              </div>
            </div>

            <div className="mt-4">
              <Field label="Opomba">
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="field-input min-h-28 resize-none"
                  placeholder="Dodatna opomba na računu..."
                />
              </Field>
            </div>
          </section>
        </div>

        <aside className="space-y-8">
          <section className="glass-panel rounded-[1.75rem] p-6">
            <h2 className="text-xl font-semibold">Povzetek</h2>

            <div className="mt-5 space-y-3 text-sm">
              <SummaryRow label="Neto" value={`${totals.net.toFixed(2)} EUR`} />
              <SummaryRow label="DDV" value={`${totals.vat.toFixed(2)} EUR`} />
              <SummaryRow
                label="Za plačilo"
                value={`${totals.gross.toFixed(2)} EUR`}
                strong
              />
            </div>
          </section>

          <section className="solid-panel rounded-[1.75rem] p-6">
            <div className="mb-4 flex items-center gap-2">
              <FileCode2 className="h-5 w-5 text-[var(--app-primary)]" />
              <h2 className="text-xl font-semibold">XML predogled</h2>
            </div>

            <pre className="max-h-[520px] overflow-auto rounded-2xl border border-[var(--app-border)] bg-[var(--app-soft)] p-4 text-xs leading-relaxed app-muted">
              {xmlPreview}
            </pre>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="app-muted mb-2 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
      <span className="app-muted">{label}:</span> {value || "-"}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3 last:border-b-0">
      <span className="app-muted">{label}</span>
      <span className={strong ? "text-lg font-semibold" : "font-medium"}>
        {value}
      </span>
    </div>
  );
}