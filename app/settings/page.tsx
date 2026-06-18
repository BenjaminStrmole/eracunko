"use client";

import { useEffect, useState } from "react";
import { syncDbActiveCompany } from "../../lib/client/activeCompany";
import AppShell from "../components/AppShell";
import { useToast } from "../components/ToastProvider";
import InlineFieldAssistant from "../components/InlineFieldAssistant";
import { useSettingsWizardAssistant } from "./useSettingsWizardAssistant";

type CompanySettings = {
  name: string;
  vatNumber: string;
  registrationNumber: string;
  street: string;
  iban: string;
  bic: string;
  address: string;
  postCode: string;
  city: string;
  country: string;
  eLocation: string;
  eAddress: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
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
  street: "",
  iban: "",
  bic: "",
  address: "",
  postCode: "",
  city: "",
  country: "SI",
  eLocation: "",
  eAddress: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  email: "",
  phone: "",
  defaultDueDays: "15",
  invoicePrefix: "",
  isVatPayer: true,
};

function buildAddress(settings: CompanySettings) {
  return [
    settings.street || settings.address,
    [settings.postCode, settings.city].filter(Boolean).join(" "),
    settings.country,
  ]
    .filter(Boolean)
    .join(", ");
}

export default function SettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<CompanySettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    queueMicrotask(async () => {
      const savedSettings = localStorage.getItem("companySettings");
      const activeCompany = localStorage.getItem("activeCompany");
      const localSettings = savedSettings
        ? { ...defaultSettings, ...JSON.parse(savedSettings) }
        : defaultSettings;
      const localCompany = activeCompany ? JSON.parse(activeCompany) : null;

      setSettings({
        ...localSettings,
        name: localSettings.name || localCompany?.name || "",
        vatNumber: localSettings.vatNumber || localCompany?.vatNumber || localCompany?.taxId || "",
        registrationNumber: localSettings.registrationNumber || localCompany?.registrationNumber || "",
        address: localSettings.address || localCompany?.address || "",
        street: localSettings.street || localCompany?.street || "",
        postCode: localSettings.postCode || localCompany?.postCode || "",
        city: localSettings.city || localCompany?.city || "",
        country: localSettings.country || localCompany?.country || "SI",
        eLocation: localSettings.eLocation || localCompany?.eLocation || "",
        eAddress: localSettings.eAddress || localCompany?.eAddress || "",
        iban: localSettings.iban || localCompany?.iban || "",
        bic: localSettings.bic || localCompany?.bic || "",
        contactName: localSettings.contactName || localCompany?.contactName || "",
        contactEmail: localSettings.contactEmail || localCompany?.contactEmail || localSettings.email || "",
        contactPhone: localSettings.contactPhone || localCompany?.contactPhone || localSettings.phone || "",
      });

      try {
        const response = await fetch("/api/settings/company", { cache: "no-store" });
        const data = await response.json();

        if (response.ok && data.success && data.company) {
          setSettings((current) => ({
            ...current,
            ...data.company,
            vatNumber: data.company.vatNumber || data.company.taxId || current.vatNumber,
            street: data.company.street || current.street,
            address: data.company.address || current.address,
            email: data.company.contactEmail || current.email,
            phone: data.company.contactPhone || current.phone,
          }));
        }
      } catch {
        toast.warning(
          "Podatki podjetja so naloženi lokalno",
          "Baze trenutno ni bilo mogoče prebrati, zato uporabljamo lokalni fallback."
        );
      } finally {
        setLoading(false);
      }
    });
  }, []);

  function updateField<K extends keyof CompanySettings>(
    field: K,
    value: CompanySettings[K]
  ) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  async function saveSettings() {
    if (!settings.name.trim()) {
      toast.warning("Manjka naziv podjetja", "Vnesi naziv podjetja.");
      return false;
    }

    if (!settings.vatNumber.trim()) {
      toast.warning("Manjka davčna številka", "Vnesi davčno številko podjetja.");
      return false;
    }

    setSaving(true);
    localStorage.setItem("companySettings", JSON.stringify(settings));

    const activeCompany = JSON.parse(localStorage.getItem("activeCompany") || "null");

    if (activeCompany) {
      const updatedCompany = {
        ...activeCompany,
        name: settings.name,
        vatNumber: settings.vatNumber,
        taxId: activeCompany.taxId || settings.vatNumber,
        registrationNumber: settings.registrationNumber,
        address: buildAddress(settings),
        street: settings.street || settings.address,
        postCode: settings.postCode,
        city: settings.city,
        country: settings.country,
        eLocation: settings.eLocation || activeCompany.eLocation,
        eAddress: settings.eAddress || activeCompany.eAddress,
        iban: settings.iban,
        bic: settings.bic,
        contactName: settings.contactName,
        contactEmail: settings.contactEmail,
        contactPhone: settings.contactPhone,
      };

      localStorage.setItem("activeCompany", JSON.stringify(updatedCompany));
      syncDbActiveCompany(updatedCompany).catch(() => {});
      window.dispatchEvent(new CustomEvent("active-company-changed"));
    }

    try {
      const response = await fetch("/api/settings/company", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company: {
            name: settings.name,
            vatNumber: settings.vatNumber,
            taxId: settings.vatNumber,
            registrationNumber: settings.registrationNumber,
            address: buildAddress(settings),
            street: settings.street || settings.address,
            postCode: settings.postCode,
            city: settings.city,
            country: settings.country,
            eLocation: settings.eLocation,
            eAddress: settings.eAddress,
            iban: settings.iban,
            bic: settings.bic,
            contactName: settings.contactName,
            contactEmail: settings.contactEmail || settings.email,
            contactPhone: settings.contactPhone || settings.phone,
          },
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "SAVE_FAILED");
      }

      if (data.company) {
        const updatedCompany = {
          ...(activeCompany || {}),
          ...data.company,
        };
        localStorage.setItem("activeCompany", JSON.stringify(updatedCompany));
        window.dispatchEvent(new CustomEvent("active-company-changed"));
      }

      toast.success("Nastavitve so shranjene", "Podatki podjetja so posodobljeni v bazi.");
    } catch {
      toast.warning(
        "Shranjeno lokalno",
        "Podatkov ni bilo mogoče zapisati v bazo, lokalni fallback pa je posodobljen."
      );
    } finally {
      setSaving(false);
    }
    return true;
  }

  const fieldAssistant = useSettingsWizardAssistant({
    settings,
    loading,
    saveSettings,
  });

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
          <h2 className="text-2xl font-semibold tracking-tight">
            Podatki podjetja za pošiljanje e-računov
          </h2>
          <p className="app-muted mt-2 text-sm">
            Polja označena kot obvezna potrebuje eSLOG za izdajatelja računa.
            {loading ? " Nalagam shranjene podatke ..." : ""}
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="Naziv podjetja *" fieldId="settings.name">
              <input
                value={settings.name}
                onChange={(event) => updateField("name", event.target.value)}
                className="field-input"
                placeholder="Moje podjetje d.o.o."
              />
            </Field>

            <Field label="Davčna številka *" fieldId="settings.vatNumber">
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

            <Field label="Ulica in hišna številka *" fieldId="settings.street">
              <input
                value={settings.street || settings.address}
                onChange={(event) => {
                  updateField("street", event.target.value);
                  updateField("address", event.target.value);
                }}
                className="field-input"
                placeholder="Ulica 1"
              />
            </Field>

            <Field label="Pošta in kraj *">
              <div className="grid grid-cols-3 gap-3">
                <input
                  data-field="settings.postCode"
                  value={settings.postCode}
                  onChange={(event) => updateField("postCode", event.target.value)}
                  className="field-input"
                  placeholder="1000"
                />
                <input
                  data-field="settings.city"
                  value={settings.city}
                  onChange={(event) => updateField("city", event.target.value)}
                  className="field-input col-span-2"
                  placeholder="Ljubljana"
                />
              </div>
            </Field>

            <Field label="Država *" fieldId="settings.country">
              <input
                value={settings.country}
                onChange={(event) =>
                  updateField("country", event.target.value.toUpperCase())
                }
                className="field-input"
                placeholder="SI"
              />
            </Field>

            <Field label="eLokacija *" fieldId="settings.eLocation">
              <input
                value={settings.eLocation}
                onChange={(event) => updateField("eLocation", event.target.value)}
                className="field-input"
                placeholder="C:SI12345678"
              />
            </Field>

            <Field label="eNaslov" fieldId="settings.eAddress">
              <input
                value={settings.eAddress}
                onChange={(event) => updateField("eAddress", event.target.value)}
                className="field-input"
                placeholder="SI12345678.HQ"
              />
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

            <Field label="Kontaktna oseba">
              <input
                value={settings.contactName}
                onChange={(event) => updateField("contactName", event.target.value)}
                className="field-input"
                placeholder="Janez Novak"
              />
            </Field>

            <Field label="Kontaktni e-mail">
              <input
                type="email"
                value={settings.contactEmail}
                onChange={(event) => updateField("contactEmail", event.target.value)}
                className="field-input"
                placeholder="racuni@podjetje.si"
              />
            </Field>

            <Field label="Kontaktni telefon">
              <input
                value={settings.contactPhone}
                onChange={(event) => updateField("contactPhone", event.target.value)}
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
            data-field="settings.save"
            onClick={fieldAssistant.saveAndContinue}
            disabled={saving}
            className="primary-button mt-8 h-12 px-6 disabled:opacity-60"
          >
            {saving ? "Shranjujem ..." : "Shrani nastavitve"}
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
            <Info label="eLokacija" value={settings.eLocation} />
            <Info label="eNaslov" value={settings.eAddress} />
            <Info label="IBAN" value={settings.iban} />
            <Info label="BIC" value={settings.bic} />
            <Info
              label="Rok plačila"
              value={`${settings.defaultDueDays || 0} dni`}
            />
          </div>
        </aside>
      </div>
      <InlineFieldAssistant
        state={fieldAssistant.state}
        onNext={fieldAssistant.next}
        onClose={fieldAssistant.close}
      />
    </AppShell>
  );
}

function Field({
  label,
  children,
  fieldId,
}: {
  label: string;
  children: React.ReactNode;
  fieldId?: string;
}) {
  return (
    <div data-field={fieldId} className="rounded-2xl">
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
