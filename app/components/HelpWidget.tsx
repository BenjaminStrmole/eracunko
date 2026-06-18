"use client";

import { BookOpen, Check, CircleHelp, X } from "lucide-react";
import { driver } from "driver.js";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getGuide, guides, type GuideId } from "../../guides";
import { useFieldWizard } from "./FieldWizardProvider";

const SEEN_KEY = "eracunko-help-seen-guides";
const DISMISSED_KEY = "eracunko-help-auto-dismissed";
const PENDING_KEY = "eracunko-help-pending-guide";

function readSeenGuides() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    return new Set<GuideId>(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<GuideId>();
  }
}

export default function HelpWidget() {
  const pathname = usePathname();
  const router = useRouter();
  const fieldWizard = useFieldWizard();
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [seenGuides, setSeenGuides] = useState<Set<GuideId>>(new Set());

  const markSeen = useCallback((guideId: GuideId) => {
    setSeenGuides((current) => {
      const next = new Set(current);
      next.add(guideId);
      localStorage.setItem(SEEN_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const startGuide = useCallback((guideId: GuideId) => {
    const guide = getGuide(guideId);
    if (!guide) return;

    setOpen(false);
    if (guide.mode === "field-wizard" && guide.flow) {
      fieldWizard.start(guide.flow, {
        onCompleted: () => markSeen(guideId),
        onPaused: () => setSeenGuides(readSeenGuides()),
      });
      return;
    }

    const driverInstance = driver({
      animate: true,
      allowClose: true,
      overlayClickBehavior: "close",
      showProgress: true,
      showButtons: ["next", "previous", "close"],
      nextBtnText: "Naprej",
      prevBtnText: "Nazaj",
      doneBtnText: "Končaj",
      progressText: "{{current}} od {{total}}",
      popoverClass: "eracunko-driver-popover",
      steps: guide.steps,
      onDestroyed: () => {
        if (driverInstance.isLastStep()) markSeen(guideId);
      },
    });

    window.setTimeout(() => driverInstance.drive(), 120);
  }, [fieldWizard, markSeen]);

  function selectGuide(guideId: GuideId) {
    const guide = getGuide(guideId);
    if (!guide) return;

    if (pathname !== guide.route) {
      localStorage.setItem(PENDING_KEY, guideId);
      setOpen(false);
      router.push(guide.route);
      return;
    }

    startGuide(guideId);
  }

  function dismissAutomaticPrompt() {
    localStorage.setItem(DISMISSED_KEY, "true");
    setOpen(false);
  }

  useEffect(() => {
    const syncTimer = window.setTimeout(() => setSeenGuides(readSeenGuides()), 0);

    const pendingGuide = localStorage.getItem(PENDING_KEY) as GuideId | null;
    const pendingDefinition = pendingGuide ? getGuide(pendingGuide) : undefined;

    if (pendingGuide && pendingDefinition?.route === pathname) {
      localStorage.removeItem(PENDING_KEY);
      window.setTimeout(() => startGuide(pendingGuide), 350);
      return () => window.clearTimeout(syncTimer);
    }

    if (!localStorage.getItem(DISMISSED_KEY) && readSeenGuides().size === 0) {
      const timer = window.setTimeout(() => setOpen(true), 900);
      return () => {
        window.clearTimeout(syncTimer);
        window.clearTimeout(timer);
      };
    }
    return () => window.clearTimeout(syncTimer);
  }, [pathname, startGuide]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (open && panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={panelRef} className="fixed bottom-5 right-4 z-[90] sm:bottom-7 sm:right-7">
      {open && (
        <section
          className="mb-3 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-[1.5rem] border border-[var(--app-border)] bg-[var(--app-surface-strong)] shadow-2xl shadow-slate-950/20 backdrop-blur-2xl"
          aria-label="Pomoč in vodiči"
        >
          <div className="flex items-start justify-between border-b border-[var(--app-border)] p-5">
            <div>
              <div className="flex items-center gap-2 text-[var(--app-primary-strong)]">
                <CircleHelp className="h-5 w-5" aria-hidden="true" />
                <span className="text-sm font-semibold">eRačunko pomoč</span>
              </div>
              <h2 className="mt-2 text-xl font-semibold">Kje potrebuješ pomoč?</h2>
              <p className="app-muted mt-1 text-sm">Izberi kratek voden ogled.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--app-muted)] transition hover:bg-[var(--app-soft)] hover:text-[var(--foreground)]"
              aria-label="Zapri pomoč"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="max-h-[min(420px,62vh)] space-y-2 overflow-y-auto p-3">
            {guides.map((guide) => {
              const seen = seenGuides.has(guide.id);

              return (
                <button
                  key={guide.id}
                  type="button"
                  onClick={() => selectGuide(guide.id)}
                  className="group flex w-full items-start gap-3 rounded-2xl border border-transparent p-3 text-left transition hover:border-[var(--app-border)] hover:bg-[var(--app-soft)]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--app-soft)] text-[var(--app-primary)] transition group-hover:bg-[var(--app-primary)] group-hover:text-white">
                    {seen ? <Check className="h-4 w-4" aria-hidden="true" /> : <BookOpen className="h-4 w-4" aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{guide.title}</span>
                      {seen && <span className="app-muted text-xs">Ogledano</span>}
                    </span>
                    <span className="app-muted mt-1 block text-xs leading-relaxed">{guide.description}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-[var(--app-border)] px-5 py-3">
            <button
              type="button"
              onClick={dismissAutomaticPrompt}
              className="app-muted text-xs font-medium transition hover:text-[var(--foreground)]"
            >
              Ne prikazuj več samodejno
            </button>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="group ml-auto flex h-14 items-center gap-2 rounded-full bg-[var(--app-primary)] px-4 text-white shadow-xl shadow-blue-500/25 transition duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-blue-500/30 active:translate-y-0 sm:px-5"
        aria-expanded={open}
        aria-label="Odpri pomoč"
        data-tour="help-button"
      >
        <CircleHelp className="h-5 w-5 transition group-hover:rotate-6" aria-hidden="true" />
        <span className="text-sm font-semibold">Pomoč</span>
      </button>
    </div>
  );
}
