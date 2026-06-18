"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import InlineFieldAssistant, {
  type InlineAssistantState,
} from "../../components/InlineFieldAssistant";
import { useFieldWizard } from "../../components/FieldWizardProvider";
import type { FieldWizardAdapter } from "../../../lib/onboarding/types";

export function useSendWizardAssistant({
  ready,
  sendInvoice,
}: {
  ready: boolean;
  sendInvoice: () => Promise<boolean>;
}) {
  const { register, session, updateSession, dismissSession, completeSession } =
    useFieldWizard();
  const [state, setState] = useState<InlineAssistantState | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);

  const cleanup = useCallback(() => {
    targetRef.current?.classList.remove("field-wizard-pulse", "field-wizard-invalid");
    targetRef.current = null;
    setState(null);
  }, []);

  const showSend = useCallback(async () => {
    if (!ready || session?.status !== "active") return;
    let target: HTMLElement | null = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, attempt ? 60 : 100));
      target = document.querySelector<HTMLElement>("[data-field='invoice.send']");
      if (target) break;
    }
    cleanup();
    targetRef.current = target;
    target?.classList.add("field-wizard-pulse");
    setState({
      kind: "field",
      key: "invoice.send",
      target,
      title: "Pošlji račun",
      instruction: "Vsa obvezna polja so pripravljena. Pošlji račun v bizBox DEMO.",
      remaining: 1,
      actionLabel: "Pošlji račun",
    });
    updateSession({
      phase: "send",
      route: "/invoices/xml",
      currentFieldId: "invoice.send",
      wizardStep: 4,
    });
  }, [cleanup, ready, session?.status, updateSession]);

  const next = useCallback(async () => {
    const sent = await sendInvoice();
    if (!sent) return;
    completeSession();
    targetRef.current?.classList.remove("field-wizard-pulse");
    setState({
      kind: "success",
      key: "invoice.sent",
      target: targetRef.current,
      title: "Račun je uspešno poslan",
      instruction: "Pomočnik je zaključen.",
      remaining: 0,
    });
    window.setTimeout(() => setState(null), 4500);
  }, [completeSession, sendInvoice]);

  const adapter = useMemo<FieldWizardAdapter>(
    () => ({
      start(_flow, _callbacks, restored) {
        if (
          restored?.status === "active" &&
          (restored.phase === "review" || restored.phase === "send")
        ) {
          window.setTimeout(() => void showSend(), 0);
        }
      },
      stop: cleanup,
    }),
    [cleanup, showSend]
  );
  useEffect(() => register(adapter), [adapter, register]);
  useEffect(() => {
    if (ready) window.setTimeout(() => void showSend(), 0);
  }, [ready, showSend]);

  return (
    <InlineFieldAssistant
      state={state}
      onNext={() => void next()}
      onClose={() => {
        dismissSession();
        cleanup();
      }}
    />
  );
}
