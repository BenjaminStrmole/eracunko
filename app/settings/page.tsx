"use client";

import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";

type CompanySettings = {
  name: string;
  vatNumber: string;
  registrationNumber: string;
  iban: string;
  bic: string;
  address: string;
  postCode: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  defaultDueDays: string;
  invoicePrefix: string;
  isVatPayer: boolean;
};

const defaultSettings: CompanySettings = {
  name: "",
  vatNumber: "",
  registrationNumber: "",
  iban: "",
  bic: "",
  address: "",
  postCode: "",
  city: "",
  country: "SI",
  email: "",
  phone: "",
  defaultDueDays: "15",
  invoicePrefix: "",
  isVatPayer: true,
};

function buildAddress(settings: CompanySettings) {
  return [
    settings.address,
    [settings.postCode, settings.city].filter(Boolean).join(" "),
    settings.country,
  ]
    .filter(Boolean)
    .join(", ");
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<CompanySettings>(defaultSettings);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const savedSettings = localStorage.getItem("companySettings");
    const activeCompany = localStorage.getItem("activeCompany");

    if (savedSettings) {
      queueMicrotask(() => {
        setSettings({ ...defaultSettings, ...JSON.parse(savedSettings) });
      });
      return;
    }

    if (activeCompany) {
      const company = JSON.parse(activeCompany);

      queueMicrotask(() => {
        setSettings({
          ...defaultSettings,
          name: company.name || "",
          vatNumber: company.vatNumber || company.taxId || "",
          address: company.address || "",
        });
      });
    }
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  function updateField<K extends keyof CompanySettings>(
    field: K,
    value: CompanySettings[K]
  ) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  function saveSettings() {
    if (!settings.name.trim()) {
      setToast("Vnesi naziv podjetja.");
      return;
    }

    if (!settings.vatNumber.trim()) {
      setToast("Vnesi davčno številko podjetja.");
      return;
    }

    localStorage.setItem("companySettings", JSON.stringify(settings));

    const activeCompany = JSON.parse(localStorage.getItem("activeCompany") || "null");

    if (activeCompany) {
      const updatedCompany = {
        ...activeCompany,
        name: settings.name,
        vatNumber: settings.vatNumber,
        taxId: activeCompany.taxId || settings.vatNumber,
        address: buildAddress(settings),
      };

      localStorage.setItem("activeCompany", JSON.stringify(updatedCompany));
      window.dispatchEvent(new CustomEvent("active-company-changed"));
    }

    setToast("Nastavitve podjetja so shranjene.");
  }

  return (
    <AppShell>
      {toast && (
        <div className="fixed right-5 top-5 z-50 max-w-md rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 text-sm text-blue-100 shadow-xl backdrop-blur">
          ℹ️ {toast}
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-4xl font-bold">Nastavitve podjetja</h2>
        <p className="mt-2 text-slate-400">
          Podatki za izdajatelja, plačilo, privzete roke in številčenje računov.
        </p>
      </div>

      <div className="grid max-w-6xl gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
          <h3 className="text-2xl font-bold">Podjetje</h3>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="Naziv podjetja">
              <input
                value={settings.name}
                onChange={(event) => updateField("name", event.target.value)}
                className="input"
                placeholder="Moje podjetje d.o.o."
              />
            </Field>

            <Field label="Davčna številka">
              <input
                value={settings.vatNumber}
                onChange={(event) =>
                  updateField("vatNumber", event.target.value.toUpperCase())
                }
                className="input"
                placeholder="SI12345678"
              />
            </Field>

            <Field label="Matična številka">
              <input
                value={settings.registrationNumber}
                onChange={(event) =>
                  updateField("registrationNumber", event.target.value)
                }
                className="input"
                placeholder="1234567000"
              />
            </Field>

            <Field label="DDV zavezanec">
              <select
                value={settings.isVatPayer ? "yes" : "no"}
                onChange={(event) =>
                  updateField("isVatPayer", event.target.value === "yes")
                }
                className="input"
              >
                <option value="yes">Da</option>
                <option value="no">Ne</option>
              </select>
            </Field>

            <Field label="Ulica in hišna številka">
              <input
                value={settings.address}
                onChange={(event) => updateField("address", event.target.value)}
                className="input"
                placeholder="Ulica 1"
              />
            </Field>

            <Field label="Pošta in kraj">
              <div className="grid grid-cols-3 gap-3">
                <input
                  value={settings.postCode}
                  onChange={(event) => updateField("postCode", event.target.value)}
                  className="input"
                  placeholder="1000"
                />
                <input
                  value={settings.city}
                  onChange={(event) => updateField("city", event.target.value)}
                  className="input col-span-2"
                  placeholder="Ljubljana"
                />
              </div>
            </Field>

            <Field label="E-pošta">
              <input
                type="email"
                value={settings.email}
                onChange={(event) => updateField("email", event.target.value)}
                className="input"
                placeholder="info@podjetje.si"
              />
            </Field>

            <Field label="Telefon">
              <input
                value={settings.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                className="input"
                placeholder="+386 40 000 000"
              />
            </Field>
          </div>

          <div className="mt-10 border-t border-slate-800 pt-8">
            <h3 className="text-2xl font-bold">Plačilo in privzete vrednosti</h3>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="IBAN">
                <input
                  value={settings.iban}
                  onChange={(event) =>
                    updateField("iban", event.target.value.toUpperCase())
                  }
                  className="input"
                  placeholder="SI56 1234 5678 9012 345"
                />
              </Field>

              <Field label="BIC / SWIFT">
                <input
                  value={settings.bic}
                  onChange={(event) =>
                    updateField("bic", event.target.value.toUpperCase())
                  }
                  className="input"
                  placeholder="LJBASI2X"
                />
              </Field>

              <Field label="Privzeti rok plačila">
                <input
                  type="number"
                  min="0"
                  value={settings.defaultDueDays}
                  onChange={(event) =>
                    updateField("defaultDueDays", event.target.value)
                  }
                  className="input"
                  placeholder="15"
                />
              </Field>

              <Field label="Predpona številčenja">
                <input
                  value={settings.invoicePrefix}
                  onChange={(event) =>
                    updateField("invoicePrefix", event.target.value.toUpperCase())
                  }
                  className="input"
                  placeholder="ER"
                />
              </Field>
            </div>
          </div>

          <button
            onClick={saveSettings}
            className="mt-8 rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
          >
            Shrani nastavitve
          </button>
        </div>

        <aside className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-6">
          <h3 className="text-xl font-bold text-blue-100">Predogled izdajatelja</h3>

          <div className="mt-5 space-y-3 text-sm">
            <Info label="Naziv" value={settings.name} />
            <Info label="Davčna" value={settings.vatNumber} />
            <Info label="Matična" value={settings.registrationNumber} />
            <Info label="Naslov" value={buildAddress(settings)} />
            <Info label="IBAN" value={settings.iban} />
            <Info label="BIC" value={settings.bic} />
            <Info
              label="Rok plačila"
              value={`${settings.defaultDueDays || 0} dni`}
            />
          </div>
        </aside>
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
    <div>
      <label className="mb-2 block text-sm text-slate-300">{label}</label>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-slate-400">{label}</div>
      <div className="mt-1 font-medium text-white">{value || "-"}</div>
    </div>
  );
}
