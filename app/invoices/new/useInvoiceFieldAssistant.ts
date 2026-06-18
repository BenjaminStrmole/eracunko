"use client";

import { driver, type Driver } from "driver.js";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFieldWizard } from "../../components/FieldWizardProvider";
import {
  getFieldRule,
  getInvoiceFieldIssues,
} from "../../../lib/onboarding/invoiceFieldRules";
import type {
  FieldWizardAdapter,
  FieldWizardCallbacks,
  InvoiceFieldWizardFlow,
  ValidationIssue,
} from "../../../lib/onboarding/types";
import type { Invoice, InvoiceProfile } from "../../../types/invoice";

type AssistantOptions = {
  profile: InvoiceProfile;
  profileConfirmed: boolean;
  setProfile: (profile: InvoiceProfile) => void;
  setProfileConfirmed: (confirmed: boolean) => void;
  setStep: (step: number) => void;
  getInvoice: () => Invoice;
};

const PROFILE_LABELS: Record<InvoiceProfile, string> = {
  standard: "Standard",
  ujp: "UJP",
  hr: "HR",
  bank: "Bank",
};

export function useInvoiceFieldAssistant(options: AssistantOptions) {
  const { register } = useFieldWizard();
  const optionsRef = useRef(options);
  const driverRef = useRef<Driver | null>(null);
  const flowRef = useRef<InvoiceFieldWizardFlow | null>(null);
  const callbacksRef = useRef<FieldWizardCallbacks | null>(null);
  const currentIssueRef = useRef<ValidationIssue | null>(null);
  const pausedRef = useRef(false);
  const suppressDestroyRef = useRef(false);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const cleanupHighlight = useCallback(() => {
    document
      .querySelectorAll(".field-wizard-pulse, .field-wizard-invalid")
      .forEach((element) =>
        element.classList.remove("field-wizard-pulse", "field-wizard-invalid")
      );
  }, []);

  const destroyDriver = useCallback(
    (paused: boolean) => {
      cleanupHighlight();
      const instance = driverRef.current;
      driverRef.current = null;
      if (instance?.isActive()) {
        suppressDestroyRef.current = true;
        instance.destroy();
        suppressDestroyRef.current = false;
      }
      if (paused && !pausedRef.current) {
        pausedRef.current = true;
        callbacksRef.current?.onPaused();
      }
    },
    [cleanupHighlight]
  );

  const findTarget = useCallback(async (fieldId: string, wizardStep: number) => {
    optionsRef.current.setStep(wizardStep);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, attempt ? 60 : 100));
      const element = document.querySelector<HTMLElement>(
        `[data-field="${CSS.escape(fieldId)}"]`
      );
      if (!element) continue;

      const details = element.closest("details");
      if (details) details.open = true;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      return element;
    }

    return null;
  }, []);

  const showIssueRef = useRef<(
    issue: ValidationIssue,
    remaining: number,
    validationMessage?: string
  ) => Promise<void>>(async () => {});
  const advanceRef = useRef<() => Promise<void>>(async () => {});

  const renderHighlight = useCallback(
    async (
      issue: ValidationIssue,
      title: string,
      instruction: string,
      remaining: number,
      validationMessage?: string
    ) => {
      const element = await findTarget(issue.fieldId, issue.wizardStep);
      destroyDriver(false);
      pausedRef.current = false;

      if (element) {
        element.classList.add("field-wizard-pulse");
        if (validationMessage) element.classList.add("field-wizard-invalid");
      }

      const actionRoute = issue.actionRoute;
      const description = validationMessage
        ? `<strong class="field-wizard-error">${validationMessage}</strong><br/>${instruction}`
        : element
          ? instruction
          : `${instruction}<br/><strong>Polja ni bilo mogoče prikazati. Poskusi znova ali preveri trenutni korak obrazca.</strong>`;

      const instance = driver({
        animate: true,
        allowClose: true,
        allowKeyboardControl: true,
        overlayClickBehavior: () => {},
        showProgress: true,
        showButtons: ["next", "close"],
        nextBtnText: actionRoute ? "Odpri nastavitve" : "Naprej",
        doneBtnText: "Končaj",
        progressText: `Manjka še ${remaining}`,
        popoverClass: "eracunko-driver-popover eracunko-field-wizard-popover",
        onDestroyed: () => {
          cleanupHighlight();
          if (!suppressDestroyRef.current && flowRef.current && !pausedRef.current) {
            pausedRef.current = true;
            callbacksRef.current?.onPaused();
          }
        },
        steps: [
          {
            element: element || undefined,
            popover: {
              title,
              description,
              side: "bottom",
              align: "start",
              onNextClick: () => {
                if (actionRoute) {
                  destroyDriver(true);
                  window.location.assign(actionRoute);
                  return;
                }

                const invoice = optionsRef.current.getInvoice();
                const activeIssue = currentIssueRef.current;
                const activeRule = activeIssue
                  ? getFieldRule(invoice, activeIssue.code)
                  : undefined;
                const nextIssue = activeRule?.validate(invoice);
                if (nextIssue) {
                  void showIssueRef.current(nextIssue, remaining, nextIssue.message);
                  return;
                }

                void advanceRef.current();
              },
              onCloseClick: () => destroyDriver(true),
            },
          },
        ],
      });

      driverRef.current = instance;
      instance.drive();

      if (element) {
        window.setTimeout(() => {
          const focusable = element.matches("input, select, textarea, button")
            ? element
            : element.querySelector<HTMLElement>("input, select, textarea, button");
          focusable?.focus({ preventScroll: true });
        }, 420);
      }
    },
    [cleanupHighlight, destroyDriver, findTarget]
  );

  const showProfileChoice = useCallback(async () => {
    const issue: ValidationIssue = {
      code: "profile.selection",
      fieldId: "profile.selection",
      wizardStep: 0,
      message: "Izberi profil računa.",
      severity: "error",
    };
    currentIssueRef.current = issue;
    await renderHighlight(
      issue,
      "Izberi profil računa",
      "Izberi Standard, UJP, HR ali Bank. Asistent bo takoj prilagodil obvezna polja.",
      1
    );
  }, [renderHighlight]);

  const showCompletion = useCallback(async () => {
    destroyDriver(false);
    flowRef.current = null;
    pausedRef.current = true;
    optionsRef.current.setStep(3);
    callbacksRef.current?.onCompleted();

    const element = await findTarget("invoice.review", 3);
    const instance = driver({
      animate: true,
      allowClose: true,
      showButtons: ["close"],
      popoverClass: "eracunko-driver-popover eracunko-field-wizard-popover",
      steps: [{
        element: element || undefined,
        popover: {
          title: "Vsa obvezna polja so izpolnjena",
          description: "Račun je pripravljen za končni pregled. Opozorila lahko še vedno preveriš pred pripravo XML-ja.",
          side: "top",
        },
      }],
    });
    driverRef.current = instance;
    instance.drive();
  }, [destroyDriver, findTarget]);

  const advance = useCallback(async () => {
    if (!flowRef.current) return;
    if (!optionsRef.current.profileConfirmed) {
      await showProfileChoice();
      return;
    }

    const invoice = optionsRef.current.getInvoice();
    const issues = getInvoiceFieldIssues(invoice);
    if (issues.length === 0) {
      await showCompletion();
      return;
    }

    const next = issues[0];
    const activeRule = getFieldRule(invoice, next.code);
    currentIssueRef.current = next;
    await renderHighlight(
      next,
      activeRule?.label || "Obvezno polje",
      activeRule?.instruction || next.message,
      issues.length
    );
  }, [renderHighlight, showCompletion, showProfileChoice]);

  const showIssue = useCallback(
    async (issue: ValidationIssue, remaining: number, validationMessage?: string) => {
      const invoice = optionsRef.current.getInvoice();
      const activeRule = getFieldRule(invoice, issue.code);
      currentIssueRef.current = issue;
      await renderHighlight(
        issue,
        activeRule?.label || "Preveri polje",
        activeRule?.instruction || issue.message,
        remaining,
        validationMessage
      );
    },
    [renderHighlight]
  );

  useEffect(() => {
    advanceRef.current = advance;
    showIssueRef.current = showIssue;
  }, [advance, showIssue]);

  const adapter = useMemo<FieldWizardAdapter>(
    () => ({
      start(flow, callbacks) {
        destroyDriver(false);
        flowRef.current = flow;
        callbacksRef.current = callbacks;
        pausedRef.current = false;

        if (flow !== "invoice") {
          optionsRef.current.setProfile(flow);
          optionsRef.current.setProfileConfirmed(true);
        }

        window.setTimeout(() => void advanceRef.current(), 0);
      },
      stop() {
        flowRef.current = null;
        destroyDriver(false);
      },
    }),
    [destroyDriver]
  );

  useEffect(() => register(adapter), [adapter, register]);

  useEffect(() => {
    if (flowRef.current && options.profileConfirmed) {
      window.setTimeout(() => void advanceRef.current(), 0);
    }
  }, [options.profile, options.profileConfirmed]);

  return {
    isRunning: () => Boolean(flowRef.current),
    selectedProfileLabel: PROFILE_LABELS[options.profile],
  };
}
