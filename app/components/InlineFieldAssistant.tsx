"use client";

import { ArrowRight, CheckCircle2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type InlineAssistantState = {
  kind: "field" | "success";
  key: string;
  target: HTMLElement | null;
  title: string;
  instruction: string;
  error?: string;
  remaining: number;
  actionLabel?: string;
};

type Position = { key: string; left: number; top: number };

export default function InlineFieldAssistant({
  state,
  onNext,
  onClose,
}: {
  state: InlineAssistantState | null;
  onNext: () => void;
  onClose: () => void;
}) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position>({ key: "", left: 16, top: 16 });
  const [confirmingForKey, setConfirmingForKey] = useState<string | null>(null);

  useEffect(() => {
    if (!state) return;
    const currentState = state;

    function updatePosition() {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;
      const width = tooltip.offsetWidth;
      const height = tooltip.offsetHeight;
      const margin = 12;
      const gap = 14;
      const targetRect = currentState.target?.getBoundingClientRect();

      if (!targetRect || targetRect.width === 0 || targetRect.height === 0) {
        setPosition({
          key: currentState.key,
          left: Math.max(margin, window.innerWidth - width - 24),
          top: Math.max(margin, window.innerHeight - height - 24),
        });
        return;
      }

      let left: number;
      let top: number;
      if (targetRect.right + gap + width <= window.innerWidth - margin) {
        left = targetRect.right + gap;
        top = targetRect.top + targetRect.height / 2 - height / 2;
      } else if (targetRect.left - gap - width >= margin) {
        left = targetRect.left - gap - width;
        top = targetRect.top + targetRect.height / 2 - height / 2;
      } else if (targetRect.bottom + gap + height <= window.innerHeight - margin) {
        left = targetRect.left;
        top = targetRect.bottom + gap;
      } else {
        left = targetRect.left;
        top = targetRect.top - gap - height;
      }

      setPosition({
        key: currentState.key,
        left: Math.min(Math.max(margin, left), window.innerWidth - width - margin),
        top: Math.min(Math.max(margin, top), window.innerHeight - height - margin),
      });
    }

    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [state]);

  useEffect(() => {
    if (!state) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setConfirmingForKey(state?.key || null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [state]);

  if (!state) return null;

  return (
    <div
      ref={tooltipRef}
      key={state.key}
      className={`inline-field-assistant ${state.kind === "success" ? "inline-field-assistant-success" : ""}`}
      style={{
        left: position.left,
        top: position.top,
        opacity: position.key === state.key ? 1 : 0,
      }}
      role={state.kind === "success" ? "status" : "dialog"}
      aria-live="polite"
    >
      <button
        type="button"
        className="inline-field-assistant-close"
        onClick={() => setConfirmingForKey(state.key)}
        aria-label="Zapri asistenta"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>

      {confirmingForKey === state.key ? (
        <div className="pr-6">
          <div className="text-sm font-semibold">Želite zapreti pomočnika?</div>
          <p className="app-muted mt-1 text-xs leading-relaxed">
            Napredek bo shranjen, vendar se pomočnik ne bo več samodejno nadaljeval.
          </p>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="inline-field-assistant-continue"
              onClick={() => setConfirmingForKey(null)}
            >
              Nadaljuj
            </button>
            <button
              type="button"
              className="inline-field-assistant-dismiss"
              onClick={onClose}
            >
              Zapri pomočnika
            </button>
          </div>
        </div>
      ) : <>
      <div className="flex items-start gap-3 pr-6">
        {state.kind === "success" && (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" />
        )}
        <div>
          <div className="text-sm font-semibold">{state.title}</div>
          {state.error && (
            <p className="mt-1 text-xs font-semibold text-[var(--app-danger)]">
              {state.error}
            </p>
          )}
          <p className="app-muted mt-1 text-xs leading-relaxed">{state.instruction}</p>
        </div>
      </div>

      {(state.kind === "field" || state.actionLabel) && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="app-muted text-[11px]">
            {state.kind === "field" ? `Manjka še ${state.remaining}` : ""}
          </span>
          <button type="button" className="inline-field-assistant-next" onClick={onNext}>
            {state.actionLabel || "Naprej"}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
      </>}
    </div>
  );
}
