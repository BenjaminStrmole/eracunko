"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldWizard } from "../../components/FieldWizardProvider";
import {
  getFieldRule,
  getInvoiceFieldIssues,
  getMissingSellerFields,
} from "../../../lib/onboarding/invoiceFieldRules";
import type {
  FieldWizardAdapter,
  FieldWizardCallbacks,
  InvoiceFieldWizardFlow,
  ValidationIssue,
} from "../../../lib/onboarding/types";
import type { Invoice, InvoiceProfile } from "../../../types/invoice";
import type { InlineAssistantState } from "../../components/InlineFieldAssistant";

type AssistantOptions = {
  profile: InvoiceProfile;
  profileConfirmed: boolean;
  setProfile: (profile: InvoiceProfile) => void;
  setProfileConfirmed: (confirmed: boolean) => void;
  setStep: (step: number) => void;
  getInvoice: () => Invoice;
  restoreInvoice: (invoice: Invoice) => void;
  ready: boolean;
};

export function useInvoiceFieldAssistant(options: AssistantOptions) {
  const router = useRouter();
  const { register, updateSession, dismissSession } = useFieldWizard();
  const [state, setState] = useState<InlineAssistantState | null>(null);
  const optionsRef = useRef(options);
  const flowRef = useRef<InvoiceFieldWizardFlow | null>(null);
  const callbacksRef = useRef<FieldWizardCallbacks | null>(null);
  const currentIssueRef = useRef<ValidationIssue | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const remainingRef = useRef(0);
  const renderTokenRef = useRef(0);
  const successTimerRef = useRef<number | null>(null);
  const pendingRestoreRef = useRef<Invoice | null>(null);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const cleanupHighlight = useCallback(() => {
    targetRef.current?.classList.remove(
      "field-wizard-pulse",
      "field-wizard-invalid"
    );
    targetRef.current = null;
  }, []);

  const stop = useCallback(
    (paused: boolean) => {
      const wasRunning = Boolean(flowRef.current);
      renderTokenRef.current += 1;
      if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
      cleanupHighlight();
      setState(null);
      flowRef.current = null;
      currentIssueRef.current = null;
      if (paused && wasRunning) callbacksRef.current?.onPaused();
    },
    [cleanupHighlight]
  );

  const findTarget = useCallback(async (fieldId: string, wizardStep: number) => {
    optionsRef.current.setStep(wizardStep);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise<void>((resolve) =>
        window.setTimeout(resolve, attempt ? 60 : 100)
      );
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
    error?: string
  ) => Promise<void>>(async () => {});
  const advanceRef = useRef<() => Promise<void>>(async () => {});
  const nextRef = useRef<() => void>(() => {});

  const showIssue = useCallback(
    async (issue: ValidationIssue, remaining: number, error?: string) => {
      const renderToken = ++renderTokenRef.current;
      const invoice = optionsRef.current.getInvoice();
      const activeRule = getFieldRule(invoice, issue.code);
      const target = await findTarget(issue.fieldId, issue.wizardStep);
      if (renderToken !== renderTokenRef.current) return;

      cleanupHighlight();
      currentIssueRef.current = issue;
      remainingRef.current = remaining;
      targetRef.current = target;

      if (target) {
        target.classList.add("field-wizard-pulse");
        if (error) target.classList.add("field-wizard-invalid");
      }

      setState({
        kind: "field",
        key: `${issue.code}:${error || "ready"}`,
        target,
        title: activeRule?.label || "Obvezno polje",
        instruction: target
          ? activeRule?.instruction || issue.message
          : `${activeRule?.instruction || issue.message} Polja trenutno ni mogoče prikazati; preveri odprti korak in poskusi znova.`,
        error,
        remaining,
        actionLabel: issue.actionRoute ? "Odpri nastavitve" : "Naprej",
      });
      updateSession({
        profile: invoice.profile,
        phase: "invoice",
        route: "/invoices/new",
        currentFieldId: issue.fieldId,
        wizardStep: issue.wizardStep,
        invoiceDraft: invoice,
      });

      if (target) {
        window.setTimeout(() => {
          const focusable = target.matches("input, select, textarea, button")
            ? target
            : target.querySelector<HTMLElement>(
                "input, select, textarea, button"
              );
          focusable?.focus({ preventScroll: true });
        }, 180);
      }
    },
    [cleanupHighlight, findTarget, updateSession]
  );

  const showProfileChoice = useCallback(async () => {
    const renderToken = ++renderTokenRef.current;
    const issue: ValidationIssue = {
      code: "profile.selection",
      fieldId: "profile.selection",
      wizardStep: 0,
      message: "Izberi profil računa.",
      severity: "error",
    };
    const target = await findTarget(issue.fieldId, issue.wizardStep);
    if (renderToken !== renderTokenRef.current) return;
    cleanupHighlight();
    currentIssueRef.current = issue;
    remainingRef.current = 1;
    targetRef.current = target;
    target?.classList.add("field-wizard-pulse");
    setState({
      kind: "field",
      key: issue.code,
      target,
      title: "Izberi profil računa",
      instruction:
        "Izberi Standard, UJP, HR ali Bank. Asistent bo nato prikazal samo potrebna polja.",
      remaining: 1,
      actionLabel: "Naprej",
    });
    updateSession({
      phase: "invoice",
      route: "/invoices/new",
      currentFieldId: issue.fieldId,
      wizardStep: issue.wizardStep,
      invoiceDraft: optionsRef.current.getInvoice(),
    });
  }, [cleanupHighlight, findTarget, updateSession]);

  const showCompletion = useCallback(async () => {
    const renderToken = ++renderTokenRef.current;
    cleanupHighlight();
    flowRef.current = null;
    currentIssueRef.current = null;
    optionsRef.current.setStep(3);
    const invoice = optionsRef.current.getInvoice();
    updateSession({
      status: "active",
      phase: "review",
      route: "/invoices/new",
      currentFieldId: "invoice.review",
      wizardStep: 3,
      invoiceDraft: invoice,
      pendingSellerFields: [],
    });
    const target = await findTarget("invoice.review", 3);
    if (renderToken !== renderTokenRef.current) return;
    setState({
      kind: "success",
      key: "completed",
      target,
      title: "Obvezna polja so izpolnjena",
      instruction: "Račun je pripravljen za pregled in pošiljanje.",
      remaining: 0,
    });
    successTimerRef.current = window.setTimeout(() => {
      setState(null);
      successTimerRef.current = null;
    }, 4500);
  }, [cleanupHighlight, findTarget, updateSession]);

  const advance = useCallback(async () => {
    if (!flowRef.current || !optionsRef.current.ready) return;
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

    await showIssue(issues[0], issues.length);
  }, [showCompletion, showIssue, showProfileChoice]);

  const next = useCallback(() => {
    const issue = currentIssueRef.current;
    if (!issue) return;

    if (issue.actionRoute) {
      const invoice = optionsRef.current.getInvoice();
      cleanupHighlight();
      setState(null);
      updateSession({
        status: "active",
        phase: "settings",
        route: issue.actionRoute,
        currentFieldId: issue.fieldId,
        wizardStep: issue.wizardStep,
        profile: invoice.profile,
        invoiceDraft: invoice,
        pendingSellerFields: getMissingSellerFields(invoice),
      });
      router.push(issue.actionRoute);
      return;
    }

    if (issue.code === "profile.selection") {
      if (!optionsRef.current.profileConfirmed) {
        void showProfileChoice();
        return;
      }
      void advanceRef.current();
      return;
    }

    const invoice = optionsRef.current.getInvoice();
    const activeRule = getFieldRule(invoice, issue.code);
    const validationIssue = activeRule?.validate(invoice);
    if (validationIssue) {
      void showIssueRef.current(
        validationIssue,
        remainingRef.current,
        validationIssue.message
      );
      return;
    }

    void advanceRef.current();
  }, [cleanupHighlight, router, showProfileChoice, updateSession]);

  useEffect(() => {
    advanceRef.current = advance;
    showIssueRef.current = showIssue;
    nextRef.current = next;
  }, [advance, next, showIssue]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!flowRef.current) return;
      if (
        event.key !== "Enter" ||
        event.isComposing ||
        currentIssueRef.current?.code === "profile.selection"
      ) {
        return;
      }

      const eventTarget = event.target as HTMLElement | null;
      const activeTarget = targetRef.current;
      if (
        !eventTarget ||
        !activeTarget?.contains(eventTarget) ||
        eventTarget.tagName === "TEXTAREA"
      ) {
        return;
      }

      event.preventDefault();
      nextRef.current();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [stop]);

  const adapter = useMemo<FieldWizardAdapter>(
    () => ({
      start(flow, callbacks, session) {
        stop(false);
        flowRef.current = flow;
        callbacksRef.current = callbacks;

        if (session?.invoiceDraft) {
          if (optionsRef.current.ready) {
            optionsRef.current.restoreInvoice(session.invoiceDraft);
          } else {
            pendingRestoreRef.current = session.invoiceDraft;
          }
        }

        if (session?.profile) {
          optionsRef.current.setProfile(session.profile);
          optionsRef.current.setProfileConfirmed(true);
        }

        if (typeof session?.wizardStep === "number") {
          optionsRef.current.setStep(session.wizardStep);
        }

        if (flow !== "invoice") {
          optionsRef.current.setProfile(flow);
          optionsRef.current.setProfileConfirmed(true);
        }

        if (optionsRef.current.ready) {
          window.setTimeout(() => void advanceRef.current(), 0);
        }
      },
      stop() {
        stop(false);
      },
    }),
    [stop]
  );

  useEffect(() => register(adapter), [adapter, register]);

  useEffect(() => {
    if (options.ready && pendingRestoreRef.current) {
      optionsRef.current.restoreInvoice(pendingRestoreRef.current);
      pendingRestoreRef.current = null;
    }

    if (flowRef.current && options.profileConfirmed && options.ready) {
      window.setTimeout(() => void advanceRef.current(), 0);
    }
  }, [options.profile, options.profileConfirmed, options.ready]);

  return {
    state,
    next,
    close: () => {
      dismissSession();
      stop(false);
    },
  };
}
