"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Vim-style two-key navigation (g + letter) plus single-key shortcuts.
// We ignore presses inside inputs/contenteditable so users typing in the
// command palette or filter boxes don't accidentally navigate away.

const SHORTCUTS: Array<{ keys: string; label: string; href?: string; action?: string }> = [
  { keys: "/", label: "Open search palette" },
  { keys: "?", label: "Show this help" },
  { keys: "r", label: "Refresh data now", action: "refresh" },
  { keys: "g d", label: "Dashboard", href: "/" },
  { keys: "g b", label: "Brief", href: "/brief" },
  { keys: "g t", label: "Threads", href: "/threads" },
  { keys: "g i", label: "Insights", href: "/insights" },
  { keys: "g n", label: "Network", href: "/network" },
  { keys: "g r", label: "Trends", href: "/trends" },
  { keys: "g m", label: "Map", href: "/map" },
  { keys: "g p", label: "Predictions", href: "/predictions" },
  { keys: "g s", label: "Sources", href: "/sources" },
  { keys: "g x", label: "Source intel", href: "/sources/intelligence" },
  { keys: "g e", label: "Ingestion", href: "/ingestion" },
  { keys: "Esc", label: "Close modal / palette" },
];

const G_TARGETS: Record<string, string> = {
  d: "/",
  b: "/brief",
  t: "/threads",
  i: "/insights",
  n: "/network",
  r: "/trends",
  m: "/map",
  p: "/predictions",
  s: "/sources",
  x: "/sources/intelligence",
  e: "/ingestion",
};

export default function KeyboardShortcuts() {
  const pathname = usePathname();
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  // Timer for the "g" two-key sequence — clears after 1.2s if no follow-up.
  const gPendingRef = useRef<number | null>(null);
  const isEmbed = pathname?.startsWith("/embed") ?? false;

  useEffect(() => {
    if (isEmbed) return;
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      const inField =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable);
      if (inField) return;
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;

      // Help overlay handling
      if (ev.key === "?" || (ev.shiftKey && ev.key === "/")) {
        ev.preventDefault();
        setHelpOpen((o) => !o);
        return;
      }
      if (ev.key === "Escape" && helpOpen) {
        setHelpOpen(false);
        return;
      }

      // Manual data refresh — just bounce the router.
      if (ev.key === "r") {
        ev.preventDefault();
        router.refresh();
        return;
      }

      // Two-key "g X" combo
      if (gPendingRef.current != null) {
        const dest = G_TARGETS[ev.key.toLowerCase()];
        window.clearTimeout(gPendingRef.current);
        gPendingRef.current = null;
        if (dest) {
          ev.preventDefault();
          router.push(dest);
        }
        return;
      }
      if (ev.key === "g") {
        gPendingRef.current = window.setTimeout(() => {
          gPendingRef.current = null;
        }, 1_200);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, helpOpen, isEmbed]);

  if (!helpOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={() => setHelpOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-950/95 shadow-[0_30px_80px_-20px_rgba(34,211,238,0.25)]"
      >
        <header className="flex items-center justify-between border-b border-white/5 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-100">Keyboard shortcuts</h2>
          <button
            onClick={() => setHelpOpen(false)}
            className="text-xs text-slate-500 hover:text-slate-200"
            aria-label="Close"
          >
            Esc
          </button>
        </header>
        <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 p-5 sm:grid-cols-2">
          {SHORTCUTS.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-900/60"
            >
              <span className="text-slate-300">{s.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                {s.keys.split(" ").map((k, i) => (
                  <kbd
                    key={i}
                    className="rounded-md border border-slate-700 bg-slate-900/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-300"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
        <footer className="border-t border-white/5 bg-slate-900/40 px-5 py-2.5 text-[11px] text-slate-500">
          Two-key shortcuts: tap{" "}
          <kbd className="rounded bg-slate-800/70 px-1 font-mono text-slate-400">g</kbd>{" "}
          then a letter within 1.2s. Shortcuts pause while typing in text fields.
        </footer>
      </div>
    </div>
  );
}
