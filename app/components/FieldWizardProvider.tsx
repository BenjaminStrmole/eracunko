"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";
import type {
  FieldWizardAdapter,
  FieldWizardCallbacks,
  InvoiceFieldWizardFlow,
} from "../../lib/onboarding/types";

type PendingStart = {
  flow: InvoiceFieldWizardFlow;
  callbacks: FieldWizardCallbacks;
};

type FieldWizardContextValue = {
  register: (adapter: FieldWizardAdapter) => () => void;
  start: (flow: InvoiceFieldWizardFlow, callbacks: FieldWizardCallbacks) => void;
};

const FieldWizardContext = createContext<FieldWizardContextValue | null>(null);

export function FieldWizardProvider({ children }: { children: React.ReactNode }) {
  const adapterRef = useRef<FieldWizardAdapter | null>(null);
  const pendingRef = useRef<PendingStart | null>(null);

  const register = useCallback((adapter: FieldWizardAdapter) => {
    adapterRef.current = adapter;
    const pending = pendingRef.current;
    if (pending) {
      pendingRef.current = null;
      window.setTimeout(() => adapter.start(pending.flow, pending.callbacks), 0);
    }

    return () => {
      if (adapterRef.current === adapter) adapterRef.current = null;
      adapter.stop();
    };
  }, []);

  const start = useCallback(
    (flow: InvoiceFieldWizardFlow, callbacks: FieldWizardCallbacks) => {
      const adapter = adapterRef.current;
      if (adapter) {
        adapter.start(flow, callbacks);
      } else {
        pendingRef.current = { flow, callbacks };
      }
    },
    []
  );

  const value = useMemo(() => ({ register, start }), [register, start]);

  return (
    <FieldWizardContext.Provider value={value}>
      {children}
    </FieldWizardContext.Provider>
  );
}

export function useFieldWizard() {
  const value = useContext(FieldWizardContext);
  if (!value) throw new Error("useFieldWizard must be used inside FieldWizardProvider");
  return value;
}
