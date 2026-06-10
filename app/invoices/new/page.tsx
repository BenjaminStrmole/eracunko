"use client";

import { useEffect, useMemo, useState } from "react";
import type { InvoiceLine, Invoice } from "../../../types/invoice";

type Customer = {
  name: string;
  vatNumber: string;
  status: "READY" | "NOT_READY";
  eLocation: string;
  eAddress?: string;
  eAddress1?: string;
  address?: string;
  postCode?: string;
  city?: string;
  country?: string;
  network?: string;
  receiverChannel?: string;
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

type ExtendedInvoiceLine = InvoiceLine & {
  unit?: string;
  itemCode?: string;
  note?: string;
  vatCategory?: string;
  taxExemptionReason?: string;
};

type DraftInvoice = Invoice & {
  id: number;
  createdAt: string;
  paymentMethod?: string;
  paymentMeansCode?: string;
  purposeCode?: string;
  bankAccount?: string;
  bankBic?: string;
  reference?: string;
  businessProcess?: string;
  documentType?: string;
  note?: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeVat(value: string) {
  return value.replace(/\s/g, "").toUpperCase();
}

function formatAddress(customer: Customer | ActiveCompany) {
  return [
    customer.address,
    [customer.postCode, customer.city].filter(Boolean).join(" "),
    customer.country || "SI",
  ]
    .filter(Boolean)
    .join(", ");
}

function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const saved = JSON.parse(localStorage.getItem("invoices") || "[]");
  const drafts = JSON.parse(localStorage.getItem("drafts") || "[]");
  const all = [...saved, ...drafts];

  const sameYear = all.filter((invoice: any) =>
    String(invoice.number || "").startsWith(`${year}-`)
  );

  const nextNumber = sameYear.length + 1;

  return `${year}-${String(nextNumber).padStart(3, "0")}`;
}

export default function NewInvoicePage() {
  const [activeCompany, setActiveCompany] = useState<ActiveCompany | null>(null);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [serviceDate, setServiceDate] = useState(today());
  const [dueDate, setDueDate] = useState(addDays(15));

  const [documentType, setDocumentType] = useState("380");
  const [businessProcess, setBusinessProcess] = useState("P1");
  const [currency, setCurrency] = useState<"EUR">("EUR");
  const [language, setLanguage] = useState("sl");
  const [note, setNote] = useState("");

  const [paymentMethod, setPaymentMethod] = useState("TRR");
  const [paymentMeansCode, setPaymentMeansCode] = useState("30");
  const [purposeCode, setPurposeCode] = useState("OTHR");
  const [bankAccount, setBankAccount] = useState("SI56 0000 0000 0000 000");
  const [bankBic, setBankBic] = useState("");
  const [reference, setReference] = useState("");

  const [orderReference, setOrderReference] = useState("");
  const [contractReference, setContractReference] = useState("");
  const [deliveryNoteReference, setDeliveryNoteReference] = useState("");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [buyer, setBuyer] = useState<Customer | null>(null);
  const [buyerSearch, setBuyerSearch] = useState("");
  const [toast, setToast] = useState("");

  const [lines, setLines] = useState<ExtendedInvoiceLine[]>([
    {
      id: 1,
      description: "Svetovanje",
      quantity: 1,
      price: 100,
      vatRate: 22,
      unit: "HUR",
      itemCode: "",
      note: "",
      vatCategory: "S",
      taxExemptionReason: "",
    },
  ]);

  useEffect(() => {
    const company = JSON.parse(localStorage.getItem("activeCompany") || "null");
    setActiveCompany(company);

    const number = generateInvoiceNumber();

    setInvoiceNumber(number);
    setReference(`SI00-${number.replace("-", "")}`);

    const savedCustomers: Customer[] = JSON.parse(
      localStorage.getItem("customers") || "[]"
    );

    setCustomers(savedCustomers);

    const params = new URLSearchParams(window.location.search);
    const vat = params.get("vat");

    if (vat) {
      const selected = savedCustomers.find(
        (customer) => normalizeVat(customer.vatNumber) === normalizeVat(vat)
      );

      if (selected) {
        setBuyer(selected);
        setBuyerSearch(selected.name);
      }
    }
  }, []);

  useEffect(() => {
    const handleCompanyChange = () => {
      const company = JSON.parse(localStorage.getItem("activeCompany") || "null");
      setActiveCompany(company);
    };

    window.addEventListener("active-company-changed", handleCompanyChange);

    return () => {
      window.removeEventListener("active-company-changed", handleCompanyChange);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!invoiceNumber) return;
    setReference(`SI00-${invoiceNumber.replaceAll("-", "")}`);
  }, [invoiceNumber]);

  const favoriteCustomers = customers.filter((customer) => customer.isFavorite);

  const filteredCustomers = customers.filter((customer) => {
    const query = buyerSearch.toLowerCase();

    if (!query) return true;

    return (
      customer.name.toLowerCase().includes(query) ||
      customer.vatNumber.toLowerCase().includes(query) ||
      customer.eLocation.toLowerCase().includes(query)
    );
  });

  const totals = useMemo(() => {
    const net = lines.reduce((sum, line) => sum + line.quantity * line.price, 0);

    const vat = lines.reduce(
      (sum, line) => sum + line.quantity * line.price * (line.vatRate / 100),
      0
    );

    return {
      net,
      vat,
      gross: net + vat,
    };
  }, [lines]);

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("sl-SI", {
      style: "currency",
      currency,
    }).format(value);

  function updateLine(
    id: number,
    field: keyof ExtendedInvoiceLine,
    value: string
  ) {
    setLines((current) =>
      current.map((line) =>
        line.id === id
          ? {
              ...line,
              [field]:
                field === "description" ||
                field === "unit" ||
                field === "itemCode" ||
                field === "note" ||
                field === "vatCategory" ||
                field === "taxExemptionReason"
                  ? value
                  : Number(value.replace(",", ".")) || 0,
            }
          : line
      )
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
        itemCode: "",
        note: "",
        vatCategory: "S",
        taxExemptionReason: "",
      },
    ]);
  }

  function removeLine(id: number) {
    setLines((current) => current.filter((line) => line.id !== id));
  }

  function selectBuyer(customer: Customer) {
    setBuyer(customer);
    setBuyerSearch(customer.name);
  }

  function buildInvoice(): Invoice {
    if (!buyer) {
      throw new Error("Najprej izberi kupca iz šifranta strank.");
    }

    const invoice: Invoice & Record<string, any> = {
      number: invoiceNumber,
      issueDate,
      serviceDate,
      dueDate,
      currency,
      seller: {
        name: activeCompany?.name || "",
        vat:
          activeCompany?.vatNumber ||
          activeCompany?.taxId ||
          "",
        address: activeCompany ? formatAddress(activeCompany) : "",
        eLocation: activeCompany?.eLocation || "",
        eAddress: activeCompany?.eAddress || "",
      },
      buyer: {
        name: buyer.name,
        vat: buyer.vatNumber,
        address: formatAddress(buyer),
        eLocation: buyer.eLocation,
        eAddress: buyer.eAddress || buyer.eAddress1,
      },
      eSlog: {
        specificationIdentifier: "urn:cen.eu:en16931:2017",
        customizationId: "urn:cen.eu:en16931:2017",
        profileId: businessProcess,
        documentType,
        paymentMeansCode,
        purposeCode,
        language,
      },
      payment: {
        method: paymentMethod,
        paymentMeansCode,
        purposeCode,
        bankAccount,
        bankBic,
        reference,
      },
      references: {
        orderReference,
        contractReference,
        deliveryNoteReference,
      },
      note,
      lines,
      totals,
    };

    return invoice;
  }

  function validateInvoice() {
    if (!activeCompany) return "Najprej izberi aktivno podjetje na strani Domov.";
    if (!buyer) return "Najprej izberi kupca iz šifranta strank.";
    if (!invoiceNumber.trim()) return "Vnesi številko računa.";
    if (!issueDate) return "Vnesi datum izdaje.";
    if (!serviceDate) return "Vnesi datum storitve.";
    if (!dueDate) return "Vnesi rok plačila.";
    if (!documentType) return "Izberi tip dokumenta.";
    if (!businessProcess) return "Izberi poslovni proces.";
    if (!purposeCode.trim()) return "Vnesi kodo namena.";
    if (!paymentMeansCode.trim()) return "Izberi način plačila.";
    if (paymentMethod !== "Gotovina" && !bankAccount.trim()) return "Vnesi TRR.";
    if (!reference.trim()) return "Vnesi referenco.";
    if (lines.length === 0) return "Dodaj vsaj eno postavko.";

    const missingLineDescription = lines.some(
      (line) => !line.description.trim()
    );

    if (missingLineDescription) return "Vsaka postavka mora imeti opis.";

    const invalidQuantity = lines.some((line) => line.quantity <= 0);
    if (invalidQuantity) return "Količina mora biti večja od 0.";

    const invalidUnit = lines.some((line) => !line.unit?.trim());
    if (invalidUnit) return "Vsaka postavka mora imeti enoto mere.";

    const missingVatReason = lines.some(
      (line) =>
        Number(line.vatRate) === 0 &&
        (!line.taxExemptionReason || !line.taxExemptionReason.trim())
    );

    if (missingVatReason) {
      return "Pri 0 % DDV moraš vpisati razlog oprostitve DDV.";
    }

    return "";
  }

  function saveDraft() {
    const error = validateInvoice();

    if (error) {
      setToast(error);
      return;
    }

    const invoice = buildInvoice();

    const draft: DraftInvoice = {
      ...invoice,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      paymentMethod,
      paymentMeansCode,
      purposeCode,
      bankAccount,
      bankBic,
      reference,
      businessProcess,
      documentType,
      note,
    };

    const existingDrafts = JSON.parse(localStorage.getItem("drafts") || "[]");

    const filteredDrafts = existingDrafts.filter(
      (item: DraftInvoice) => item.number !== draft.number
    );

    localStorage.setItem("drafts", JSON.stringify([...filteredDrafts, draft]));

    setToast("Osnutek je shranjen.");
  }

  function saveAndPreview() {
    const error = validateInvoice();

    if (error) {
      setToast(error);
      return;
    }

    const invoice = {
      ...buildInvoice(),
      paymentMethod,
      paymentMeansCode,
      purposeCode,
      bankAccount,
      bankBic,
      reference,
      businessProcess,
      documentType,
      note,
    };

    localStorage.setItem("eracunko_current_invoice", JSON.stringify(invoice));
    window.location.href = "/invoices/preview";
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {toast && (
        <div className="fixed right-5 top-5 z-50 max-w-md rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 text-sm text-blue-100 shadow-xl backdrop-blur">
          ℹ️ {toast}
        </div>
      )}

      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-slate-800 bg-slate-900 p-6">
          <div className="mb-10">
            <h1 className="text-2xl font-bold">eRačunko</h1>
            <p className="text-sm text-slate-400">e-računi brez komplikacij</p>
          </div>

          <nav className="space-y-2">
            <a href="/dashboard" className="block rounded-lg px-4 py-3 hover:bg-slate-800">🏠 Domov</a>
            <a href="/inbox" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📥 Prejeti računi</a>
            <a href="/acknowledgments" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📨 Povratnice</a>
            <a href="/sent" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📤 Poslani računi</a>
            <a href="/drafts" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📝 Osnutki</a>
            <a href="/invoices/new" className="block rounded-lg bg-blue-600/20 px-4 py-3 text-blue-200">🧾 Nov račun</a>
            <a href="/customers" className="block rounded-lg px-4 py-3 hover:bg-slate-800">👥 Moje stranke</a>
            <a href="/settings" className="block rounded-lg px-4 py-3 hover:bg-slate-800">⚙️ Nastavitve</a>
          </nav>
        </aside>

        <section className="flex-1 p-10">
          <div className="mb-8">
            <h2 className="text-4xl font-bold">Nov e-račun</h2>
            <p className="mt-2 text-slate-400">
              Izberi kupca, dopolni eSLOG podatke, dodaj postavke in pripravi račun.
            </p>
          </div>

          <div className="mb-8 grid max-w-5xl grid-cols-5 gap-3">
            {["Podatki", "Kupec", "eSLOG", "Postavke", "Predogled"].map(
              (step, index) => (
                <div
                  key={step}
                  className={`rounded-xl border p-4 ${
                    index <= 3
                      ? "border-blue-500 bg-blue-500/10 text-blue-200"
                      : "border-slate-800 bg-slate-900 text-slate-400"
                  }`}
                >
                  <div className="text-sm">Korak {index + 1}</div>
                  <div className="mt-1 font-semibold">{step}</div>
                </div>
              )
            )}
          </div>

          <div className="grid max-w-7xl gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
              <h3 className="text-2xl font-bold">1. Podatki računa</h3>

              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <Field label="Številka">
                  <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="input" />
                </Field>

                <Field label="Datum izdaje">
                  <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="input" />
                </Field>

                <Field label="Datum storitve">
                  <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className="input" />
                </Field>

                <Field label="Rok plačila">
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" />
                </Field>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-5">
                <div className="text-sm text-slate-400">Izdajatelj / aktivno podjetje</div>
                <div className="mt-2 text-xl font-bold">{activeCompany?.name || "Ni izbrano"}</div>

                <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                  <InfoLine label="Davčna" value={activeCompany?.vatNumber || activeCompany?.taxId} />
                  <InfoLine label="eLokacija" value={activeCompany?.eLocation} />
                  <InfoLine label="eNaslov" value={activeCompany?.eAddress} />
                  <InfoLine label="Naslov" value={activeCompany ? formatAddress(activeCompany) : "-"} />
                </div>
              </div>

              <div className="mt-10 border-t border-slate-800 pt-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">2. Kupec</h3>
                    <p className="mt-2 text-slate-400">
                      Izberi kupca iz šifranta ali dodaj novega iz eImenika.
                    </p>
                  </div>

                  <a href="/customers/new" className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-500/20">
                    + Dodaj kupca
                  </a>
                </div>

                {favoriteCustomers.length > 0 && (
                  <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5">
                    <h4 className="text-lg font-bold text-blue-100">⭐ Priljubljene stranke</h4>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {favoriteCustomers.map((customer) => (
                        <button
                          key={customer.vatNumber}
                          onClick={() => selectBuyer(customer)}
                          className={`rounded-xl border p-4 text-left hover:bg-slate-800 ${
                            buyer?.vatNumber === customer.vatNumber
                              ? "border-green-500 bg-green-500/10"
                              : "border-slate-700 bg-slate-900"
                          }`}
                        >
                          <div className="font-bold">{customer.name}</div>
                          <div className="mt-1 text-sm text-slate-400">{customer.vatNumber}</div>
                          <div className="mt-2 text-sm text-green-300">✓ Prejema e-račune</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-5">
                  <label className="mb-2 block text-sm text-slate-300">
                    Poišči v shranjenih strankah
                  </label>

                  <input
                    value={buyerSearch}
                    onChange={(event) => setBuyerSearch(event.target.value)}
                    placeholder="Naziv, davčna ali eLokacija"
                    className="input"
                  />

                  <div className="mt-4 max-h-72 space-y-2 overflow-auto">
                    {filteredCustomers.length === 0 && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                        Ni shranjenih strank. Najprej dodaj kupca iz eImenika.
                      </div>
                    )}

                    {filteredCustomers.map((customer) => (
                      <button
                        key={customer.vatNumber}
                        onClick={() => selectBuyer(customer)}
                        className={`block w-full rounded-xl border p-4 text-left hover:bg-slate-800 ${
                          buyer?.vatNumber === customer.vatNumber
                            ? "border-green-500 bg-green-500/10"
                            : "border-slate-800 bg-slate-900"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="font-bold">{customer.name}</div>
                            <div className="mt-1 text-sm text-slate-400">
                              {customer.vatNumber} · {customer.eLocation}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {formatAddress(customer) || "Naslov ni shranjen"}
                            </div>
                          </div>

                          <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs text-green-300">
                            e-računi
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {buyer && (
                  <div className="mt-6 rounded-2xl border border-green-500/20 bg-green-500/10 p-5">
                    <div className="text-sm text-green-300">✓ Izbrana stranka</div>
                    <h4 className="mt-2 text-xl font-bold">{buyer.name}</h4>

                    <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                      <InfoLine label="Davčna" value={buyer.vatNumber} />
                      <InfoLine label="eLokacija" value={buyer.eLocation} />
                      <InfoLine label="eNaslov" value={buyer.eAddress || buyer.eAddress1} />
                      <InfoLine label="Naslov" value={formatAddress(buyer)} />
                      <InfoLine label="Omrežje" value={buyer.network || buyer.receiverChannel} />
                      <InfoLine label="Format" value={buyer.format} />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-10 border-t border-slate-800 pt-8">
                <h3 className="text-2xl font-bold">3. eSLOG in reference</h3>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <Field label="Tip dokumenta">
                    <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className="input">
                      <option value="380">380 - Račun</option>
                      <option value="381">381 - Dobropis</option>
                      <option value="386">386 - Avansni račun</option>
                      <option value="384">384 - Breme</option>
                    </select>
                  </Field>

                  <Field label="Poslovni proces">
                    <select value={businessProcess} onChange={(e) => setBusinessProcess(e.target.value)} className="input">
                      <option value="P1">P1 - Osnovni račun</option>
                      <option value="P2">P2 - Račun na podlagi naročila</option>
                      <option value="P7">P7 - Dobropis</option>
                    </select>
                  </Field>

                  <Field label="Valuta">
                    <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value as "EUR")}
                        className="input"
                    >
                        <option value="EUR">EUR</option>
                    </select>
                    </Field>

                  <Field label="Referenca naročila">
                    <input value={orderReference} onChange={(e) => setOrderReference(e.target.value)} className="input" placeholder="npr. PO-2026-001" />
                  </Field>

                  <Field label="Referenca pogodbe">
                    <input value={contractReference} onChange={(e) => setContractReference(e.target.value)} className="input" placeholder="npr. POG-2026-001" />
                  </Field>

                  <Field label="Dobavnica">
                    <input value={deliveryNoteReference} onChange={(e) => setDeliveryNoteReference(e.target.value)} className="input" placeholder="npr. DOB-2026-001" />
                  </Field>
                </div>

                <div className="mt-4">
                  <Field label="Opomba na računu">
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} className="input min-h-24" placeholder="Opcijska opomba, npr. oprostitev DDV, dogovor, interna opomba ..." />
                  </Field>
                </div>
              </div>

              <div className="mt-10 border-t border-slate-800 pt-8">
                <h3 className="text-2xl font-bold">4. Plačilni podatki</h3>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <Field label="Način plačila">
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="input">
                      <option value="TRR">TRR</option>
                      <option value="SEPA">SEPA</option>
                      <option value="Gotovina">Gotovina</option>
                    </select>
                  </Field>

                  <Field label="Koda plačila">
                    <select value={paymentMeansCode} onChange={(e) => setPaymentMeansCode(e.target.value)} className="input">
                      <option value="30">30 - Kreditno nakazilo</option>
                      <option value="42">42 - Plačilo na račun</option>
                      <option value="10">10 - Gotovina</option>
                    </select>
                  </Field>

                  <Field label="Koda namena">
                    <input value={purposeCode} onChange={(e) => setPurposeCode(e.target.value.toUpperCase())} className="input" placeholder="OTHR" />
                  </Field>

                  <Field label="TRR / IBAN">
                    <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className="input" />
                  </Field>

                  <Field label="BIC / SWIFT">
                    <input value={bankBic} onChange={(e) => setBankBic(e.target.value.toUpperCase())} className="input" placeholder="npr. LJBASI2X" />
                  </Field>

                  <Field label="Referenca plačila">
                    <input value={reference} onChange={(e) => setReference(e.target.value)} className="input" />
                  </Field>
                </div>
              </div>

              <div className="mt-10 border-t border-slate-800 pt-8">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">5. Postavke računa</h3>
                    <p className="mt-2 text-slate-400">
                      Dodajte eno ali več postavk. Zneski se izračunajo samodejno.
                    </p>
                  </div>

                  <button onClick={addLine} className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 font-semibold text-blue-200 hover:bg-blue-500/20">
                    + Dodaj postavko
                  </button>
                </div>

                <div className="space-y-4">
                  {lines.map((line, index) => {
                    const lineNet = line.quantity * line.price;
                    const lineVat = lineNet * (line.vatRate / 100);
                    const lineGross = lineNet + lineVat;

                    return (
                      <div key={line.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                        <div className="mb-4 flex items-center justify-between">
                          <div className="font-semibold">Postavka {index + 1}</div>

                          {lines.length > 1 && (
                            <button onClick={() => removeLine(line.id)} className="text-sm text-red-300 hover:text-red-200">
                              Odstrani
                            </button>
                          )}
                        </div>

                        <div className="grid gap-4 md:grid-cols-6">
                          <div className="md:col-span-3">
                            <Field label="Opis">
                              <input value={line.description} onChange={(e) => updateLine(line.id, "description", e.target.value)} className="input" placeholder="Opis storitve ali artikla" />
                            </Field>
                          </div>

                          <Field label="Šifra artikla">
                            <input value={line.itemCode || ""} onChange={(e) => updateLine(line.id, "itemCode", e.target.value)} className="input" />
                          </Field>

                          <Field label="Količina">
                            <input type="number" value={line.quantity} onChange={(e) => updateLine(line.id, "quantity", e.target.value)} className="input" />
                          </Field>

                          <Field label="Enota">
                            <select value={line.unit || "HUR"} onChange={(e) => updateLine(line.id, "unit", e.target.value)} className="input">
                              <option value="HUR">HUR - ura</option>
                              <option value="C62">C62 - kos</option>
                              <option value="KGM">KGM - kilogram</option>
                              <option value="LTR">LTR - liter</option>
                              <option value="MTR">MTR - meter</option>
                            </select>
                          </Field>

                          <Field label="Cena brez DDV">
                            <input type="number" value={line.price} onChange={(e) => updateLine(line.id, "price", e.target.value)} className="input" />
                          </Field>

                          <Field label="DDV %">
                            <select value={line.vatRate} onChange={(e) => updateLine(line.id, "vatRate", e.target.value)} className="input">
                              <option value={22}>22 %</option>
                              <option value={9.5}>9,5 %</option>
                              <option value={5}>5 %</option>
                              <option value={0}>0 %</option>
                            </select>
                          </Field>

                          <Field label="Kategorija DDV">
                            <select value={line.vatCategory || "S"} onChange={(e) => updateLine(line.id, "vatCategory", e.target.value)} className="input">
                              <option value="S">S - standardna stopnja</option>
                              <option value="E">E - oproščeno</option>
                              <option value="AE">AE - obrnjena davčna obveznost</option>
                              <option value="Z">Z - ničelna stopnja</option>
                            </select>
                          </Field>

                          <div className="md:col-span-3">
                            <Field label="Razlog oprostitve / davčno besedilo">
                              <input value={line.taxExemptionReason || ""} onChange={(e) => updateLine(line.id, "taxExemptionReason", e.target.value)} className="input" placeholder="Obvezno pri 0 % DDV" />
                            </Field>
                          </div>

                          <div className="md:col-span-6">
                            <Field label="Opomba postavke">
                              <input value={line.note || ""} onChange={(e) => updateLine(line.id, "note", e.target.value)} className="input" />
                            </Field>
                          </div>

                          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300 md:col-span-6">
                            Osnova: <strong>{formatMoney(lineNet)}</strong> · DDV:{" "}
                            <strong>{formatMoney(lineVat)}</strong> · Skupaj:{" "}
                            <strong>{formatMoney(lineGross)}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <a href="/dashboard" className="rounded-lg border border-white/15 px-6 py-3 font-semibold hover:bg-white/10">
                  Prekliči
                </a>

                <div className="flex gap-3">
                  <button onClick={saveDraft} className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-6 py-3 font-semibold text-blue-200 hover:bg-blue-500/20">
                    💾 Shrani osnutek
                  </button>

                  <button onClick={saveAndPreview} className="rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500">
                    Nadaljuj na predogled
                  </button>
                </div>
              </div>
            </div>

            <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h3 className="text-xl font-bold">Povzetek računa</h3>

              <div className="mt-6 space-y-4 text-sm">
                <SummaryLine label="Izdajatelj" value={activeCompany?.name || "Ni izbran"} />
                <SummaryLine label="Kupec" value={buyer?.name || "Ni izbran"} />
                <SummaryLine label="Številka" value={invoiceNumber || "-"} />
                <SummaryLine label="Tip" value={documentType} />
                <SummaryLine label="Proces" value={businessProcess} />
                <SummaryLine label="Plačilo" value={paymentMethod} />
                <SummaryLine label="Koda namena" value={purposeCode || "-"} />
                <SummaryLine label="Referenca" value={reference || "-"} />

                <div className="flex justify-between border-t border-slate-800 pt-4">
                  <span className="text-slate-400">Osnova</span>
                  <span>{formatMoney(totals.net)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">DDV</span>
                  <span>{formatMoney(totals.vat)}</span>
                </div>

                <div className="flex justify-between border-t border-slate-800 pt-4 text-lg font-bold">
                  <span>Skupaj</span>
                  <span>{formatMoney(totals.gross)}</span>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-300">
                ✓ Dodani so osnovni eSLOG/bizBox podatki za uspešno kreiranje računa.
              </div>

              <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-200">
                Osnutek lahko shraniš ali nadaljuješ na predogled.
              </div>
            </aside>
          </div>
        </section>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgb(51 65 85);
          background: rgb(30 41 59);
          padding: 0.75rem;
          outline: none;
        }

        .input:focus {
          border-color: rgb(59 130 246);
        }
      `}</style>
    </main>
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
    <div>
      <label className="mb-2 block text-sm text-slate-300">{label}</label>
      {children}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <span className="text-slate-500">{label}:</span> {value || "-"}
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-400">{label}</span>
      <span className="text-right">{value || "-"}</span>
    </div>
  );
}