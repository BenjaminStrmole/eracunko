"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InlineAssistantState } from "../components/InlineFieldAssistant";
import { useFieldWizard } from "../components/FieldWizardProvider";
import type { FieldWizardAdapter } from "../../lib/onboarding/types";
import type { SellerFieldId } from "../../lib/onboarding/invoiceFieldRules";

type SellerSettings = Record<SellerFieldId, string> & { address?: string };

const FIELD_META: Record<SellerFieldId, { label: string; instruction: string }> = {
  name: { label: "Naziv podjetja", instruction: "Vnesi uradni naziv izdajatelja." },
  vatNumber: { label: "Davčna številka", instruction: "Vnesi davčno številko podjetja." },
  street: { label: "Naslov podjetja", instruction: "Vnesi ulico in hišno številko." },
  postCode: { label: "Poštna številka", instruction: "Vnesi poštno številko." },
  city: { label: "Mesto", instruction: "Vnesi mesto podjetja." },
  country: { label: "Država", instruction: "Vnesi dvočrkovno oznako države, na primer SI." },
  eLocation: { label: "eLokacija", instruction: "Vnesi eLokacijo izdajatelja za elektronsko dostavo." },
  eAddress: { label: "eNaslov", instruction: "Vnesi elektronski naslov izdajatelja." },
};

function valid(field: SellerFieldId, settings: SellerSettings) {
  const value = field === "street" ? settings.street || settings.address : settings[field];
  if (field === "country") return /^[A-Z]{2}$/.test(String(value || "").trim().toUpperCase());
  return Boolean(String(value || "").trim());
}

export function useSettingsWizardAssistant({
  settings,
  loading,
  saveSettings,
}: {
  settings: SellerSettings;
  loading: boolean;
  saveSettings: () => Promise<boolean>;
}) {
  const router = useRouter();
  const { register, session, updateSession, dismissSession } = useFieldWizard();
  const [state, setState] = useState<InlineAssistantState | null>(null);
  const settingsRef = useRef(settings);
  const loadingRef = useRef(loading);
  const targetRef = useRef<HTMLElement | null>(null);
  const currentFieldRef = useRef<SellerFieldId | "save" | "return" | null>(null);
  const savedRef = useRef(false);

  useEffect(() => {
    settingsRef.current = settings;
    loadingRef.current = loading;
  }, [loading, settings]);

  const cleanup = useCallback(() => {
    targetRef.current?.classList.remove("field-wizard-pulse", "field-wizard-invalid");
    targetRef.current = null;
    setState(null);
  }, []);

  const findTarget = useCallback(async (fieldId: string) => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, attempt ? 60 : 100));
      const target = document.querySelector<HTMLElement>(
        `[data-field="${CSS.escape(fieldId)}"]`
      );
      if (!target) continue;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      return target;
    }
    return null;
  }, []);

  const advanceRef = useRef<() => Promise<void>>(async () => {});

  const showField = useCallback(
    async (field: SellerFieldId, error?: string) => {
      const target = await findTarget(`settings.${field}`);
      cleanup();
      currentFieldRef.current = field;
      targetRef.current = target;
      target?.classList.add("field-wizard-pulse");
      if (error) target?.classList.add("field-wizard-invalid");
      const remaining = (session?.pendingSellerFields || []).filter((item) =>
        !valid(item as SellerFieldId, settingsRef.current)
      ).length;
      setState({
        kind: "field",
        key: `settings.${field}:${error || "ready"}`,
        target,
        title: FIELD_META[field].label,
        instruction: FIELD_META[field].instruction,
        error,
        remaining: Math.max(1, remaining),
        actionLabel: "Naprej",
      });
      updateSession({
        phase: "settings",
        route: "/settings",
        currentFieldId: `settings.${field}`,
        pendingSellerFields: session?.pendingSellerFields || [],
      });
      window.setTimeout(
        () => {
          const focusable = target?.matches("input, select, textarea")
            ? target
            : target?.querySelector<HTMLElement>("input, select, textarea");
          focusable?.focus();
        },
        160
      );
    },
    [cleanup, findTarget, session?.pendingSellerFields, updateSession]
  );

  const showSave = useCallback(async () => {
    const target = await findTarget("settings.save");
    cleanup();
    currentFieldRef.current = "save";
    targetRef.current = target;
    target?.classList.add("field-wizard-pulse");
    setState({
      kind: "field",
      key: "settings.save",
      target,
      title: "Shrani podatke podjetja",
      instruction: "Vsa manjkajoča polja so izpolnjena. Shrani nastavitve, nato se vrni na račun.",
      remaining: 1,
      actionLabel: "Shrani nastavitve",
    });
  }, [cleanup, findTarget]);

  const showReturn = useCallback(async () => {
    const target = await findTarget("settings.save");
    cleanup();
    currentFieldRef.current = "return";
    targetRef.current = target;
    setState({
      kind: "success",
      key: "settings.return",
      target,
      title: "Podatki podjetja so shranjeni",
      instruction: "Pomočnik bo nadaljeval pri naslednjem manjkajočem polju računa.",
      remaining: 0,
      actionLabel: "Nazaj na račun",
    });
  }, [cleanup, findTarget]);

  const advance = useCallback(async () => {
    if (loadingRef.current || session?.status !== "active" || session.phase !== "settings") return;
    const pending = (session.pendingSellerFields || []) as SellerFieldId[];
    const missing = pending.find((field) => !valid(field, settingsRef.current));
    if (missing) {
      await showField(missing);
      return;
    }
    if (savedRef.current) await showReturn();
    else await showSave();
  }, [session, showField, showReturn, showSave]);

  const saveAndContinue = useCallback(async () => {
    if (session?.status !== "active" || session.phase !== "settings") {
      return saveSettings();
    }

    const pending = (session?.pendingSellerFields || []) as SellerFieldId[];
    const missing = pending.find((field) => !valid(field, settingsRef.current));
    if (missing) {
      await showField(missing, "To polje je obvezno za izdajatelja računa.");
      return false;
    }

    const saved = await saveSettings();
    if (!saved) return false;
    savedRef.current = true;
    updateSession({ pendingSellerFields: [] });
    await showReturn();
    return true;
  }, [saveSettings, session, showField, showReturn, updateSession]);

  const next = useCallback(async () => {
    const current = currentFieldRef.current;
    if (!current) return;
    if (current === "return") {
      cleanup();
      updateSession({
        phase: "invoice",
        route: "/invoices/new",
        currentFieldId: "seller.settings",
        pendingSellerFields: [],
      });
      router.push("/invoices/new");
      return;
    }
    if (current === "save") {
      await saveAndContinue();
      return;
    }
    if (!valid(current, settingsRef.current)) {
      await showField(current, "To polje je obvezno za izdajatelja računa.");
      return;
    }
    await advanceRef.current();
  }, [cleanup, router, saveAndContinue, showField, updateSession]);

  useEffect(() => {
    advanceRef.current = advance;
  }, [advance]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.key !== "Enter" ||
        event.isComposing ||
        !targetRef.current?.contains(event.target as Node) ||
        (event.target as HTMLElement).tagName === "TEXTAREA"
      ) return;
      event.preventDefault();
      void next();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [next]);

  const adapter = useMemo<FieldWizardAdapter>(
    () => ({
      start(_flow, _callbacks, restored) {
        if (restored?.status !== "active" || restored.phase !== "settings") return;
        window.setTimeout(() => void advanceRef.current(), 0);
      },
      stop: cleanup,
    }),
    [cleanup]
  );
  useEffect(() => register(adapter), [adapter, register]);
  useEffect(() => {
    if (!loading) window.setTimeout(() => void advanceRef.current(), 0);
  }, [loading]);

  return {
    state,
    next: () => void next(),
    saveAndContinue: () => void saveAndContinue(),
    close: () => {
      dismissSession();
      cleanup();
    },
  };
}
