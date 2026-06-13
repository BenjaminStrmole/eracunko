"use client";

import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { useToast } from "../components/ToastProvider";

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
  const toast = useToast();
  const [settings, setSettings] = useState<CompanySettings>(defaultSettings);

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

  function updateField<K extends keyof CompanySettings>(
    field: K,
    value: CompanySettings[K]
  ) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  function saveSettings() {
    if (!settings.name.trim()) {
      toast.warning("Manjka naziv podjetja", "Vnesi naziv podjetja.");
      return;
    }

    if (!settings.vatNumber.trim()) {
      toast.warning("Manjka davčna številka", "Vnesi davčno številko podjetja.");
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

    toast.success("Nastavitve so shranjene", "Podatki podjetja so posodobljeni.");
  }

  return (
    <AppShell>
      <div className="mb-8">
        <div className="status-pill mb-4 inline-flex">Profil izdajatelja</div>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          Nastavitve podjetja
        </h1>
        <p className="app-muted mt-3 max-w-2xl">
          Podatki za izdajatelja, plačilo, privzete roke in številčenje računov.
        </p>
      </div>

      <div className="grid max-w-6xl gap-6 lg:grid-cols-3">
        <div className="solid-panel rounded-[1.75rem] p-6 lg:col-span-2">
          <h2 className="text-2xl font-semibold tracking-tight">Podjetje</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="Naziv podjetja">
              <input
                value={settings.name}
                onChange={(event) => updateField("name", event.target.value)}
                className="field-input"
                placeholder="Moje podjetje d.o.o."
              />
            </Field>

            <Field label="Davčna številka">
              <input
                value={settings.vatNumber}
                onChange={(event) =>
                  updateField("vatNumber", event.target.value.toUpperCase())
                }
                className="field-input"
                placeholder="SI12345678"
              />
            </Field>

            <Field label="Matična številka">
              <input
                value={settings.registrationNumber}
                onChange={(event) =>
                  updateField("registrationNumber", event.target.value)
                }
                className="field-input"
                placeholder="1234567000"
              />
            </Field>

            <Field label="DDV zavezanec">
              <select
                value={settings.isVatPayer ? "yes" : "no"}
                onChange={(event) =>
                  updateField("isVatPayer", event.target.value === "yes")
                }
                className="field-input"
              >
                <option value="yes">Da</option>
                <option value="no">Ne</option>
              </select>
            </Field>

            <Field label="Ulica in hišna številka">
              <input
                value={settings.address}
                onChange={(event) => updateField("address", event.target.value)}
                className="field-input"
                placeholder="Ulica 1"
              />
            </Field>

            <Field label="Pošta in kraj">
              <div className="grid grid-cols-3 gap-3">
                <input
                  value={settings.postCode}
                  onChange={(event) => updateField("postCode", event.target.value)}
                  className="field-input"
                  placeholder="1000"
                />
                <input
                  value={settings.city}
                  onChange={(event) => updateField("city", event.target.value)}
                  className="field-input col-span-2"
                  placeholder="Ljubljana"
                />
              </div>
            </Field>

            <Field label="E-pošta">
              <input
                type="email"
                value={settings.email}
                onChange={(event) => updateField("email", event.target.value)}
                className="field-input"
                placeholder="info@podjetje.si"
              />
            </Field>

            <Field label="Telefon">
              <input
                value={settings.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                className="field-input"
                placeholder="+386 40 000 000"
              />
            </Field>
          </div>

          <div className="mt-10 border-t border-[var(--app-border)] pt-8">
            <h2 className="text-2xl font-semibold tracking-tight">
              Plačilo in privzete vrednosti
            </h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="IBAN">
                <input
                  value={settings.iban}
                  onChange={(event) =>
                    updateField("iban", event.target.value.toUpperCase())
                  }
                  className="field-input"
                  placeholder="SI56 1234 5678 9012 345"
                />
              </Field>

              <Field label="BIC / SWIFT">
                <input
                  value={settings.bic}
                  onChange={(event) =>
                    updateField("bic", event.target.value.toUpperCase())
                  }
                  className="field-input"
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
                  className="field-input"
                  placeholder="15"
                />
              </Field>

              <Field label="Predpona številčenja">
                <input
                  value={settings.invoicePrefix}
                  onChange={(event) =>
                    updateField("invoicePrefix", event.target.value.toUpperCase())
                  }
                  className="field-input"
                  placeholder="ER"
                />
              </Field>
            </div>
          </div>

          <button
            onClick={saveSettings}
            className="primary-button mt-8 h-12 px-6"
          >
            Shrani nastavitve
          </button>
        </div>

        <aside className="glass-panel rounded-[1.75rem] p-6">
          <h2 className="text-xl font-semibold">Predogled izdajatelja</h2>
          <p className="app-muted mt-1 text-sm">
            Kratek povzetek podatkov, ki bodo šli na račun.
          </p>

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
      <label className="app-muted mb-2 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
      <div className="app-muted">{label}</div>
      <div className="mt-1 break-words font-semibold">{value || "-"}</div>
    </div>
  );
}
