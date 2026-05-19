"use client";

import { Command } from "cmdk";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import type { SearchHit } from "@/lib/types";

const PAGE_SHORTCUTS: Array<{ label: string; href: string; hint?: string }> = [
  { label: "Dashboard", href: "/", hint: "g d" },
  { label: "Brief", href: "/brief", hint: "g b" },
  { label: "Threads", href: "/threads", hint: "g t" },
  { label: "Insights", href: "/insights", hint: "g i" },
  { label: "Trends", href: "/trends" },
  { label: "Map", href: "/map" },
  { label: "Predictions", href: "/predictions" },
  { label: "Network", href: "/network", hint: "g n" },
  { label: "Source Intel", href: "/sources/intelligence" },
  { label: "Sources", href: "/sources" },
  { label: "Ingestion", href: "/ingestion" },
];

const KIND_BADGE: Record<SearchHit["kind"], { label: string; tone: string }> = {
  story:  { label: "Story",  tone: "bg-cyan-500/15 text-cyan-300 ring-cyan-400/30" },
  entity: { label: "Entity", tone: "bg-violet-500/15 text-violet-300 ring-violet-400/30" },
  topic:  { label: "Topic",  tone: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30" },
};

export default function CommandPalette() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEmbed = pathname?.startsWith("/embed") ?? false;
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  // Debounce timer + abort controller so fast typing doesn't fan out 8 requests.
  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Global hotkeys: ⌘K / Ctrl+K open, "/" open when not in a text field, Esc close.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      const inField =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable);
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "k") {
        ev.preventDefault();
        setOpen((o) => !o);
      } else if (ev.key === "/" && !inField && !open) {
        ev.preventDefault();
        setOpen(true);
      } else if (ev.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Reset state when the palette closes so reopening starts fresh.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setHits([]);
    }
  }, [open]);

  // Debounced search. We don't disable cmdk's built-in fuzzy filter on PAGE_SHORTCUTS
  // because navigation suggestions should still work without a network call.
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = window.setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await api.search({ q, limit: 18 });
        if (!ctrl.signal.aborted) setHits(res.hits);
      } catch {
        if (!ctrl.signal.aborted) setHits([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  if (isEmbed) return null;

  if (!open) {
    return (
      // Floating hint at bottom-left for discoverability. Tucked next to the
      // existing AutoRefresh badge in the bottom-right.
      <button
        type="button"
        aria-label="Open command palette"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-30 hidden items-center gap-2 rounded-full border border-slate-700/60 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-400 shadow-xl backdrop-blur transition hover:border-cyan-500/40 hover:text-cyan-200 md:flex"
      >
        <span aria-hidden>⌘</span>
        <span>K</span>
        <span className="text-slate-600">·</span>
        <span>search</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/70 backdrop-blur-sm p-4 pt-[14vh]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-950/95 shadow-[0_30px_80px_-20px_rgba(34,211,238,0.25)] ring-1 ring-white/5"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Global search" shouldFilter={true} loop>
          <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
            <span aria-hidden className="text-slate-500">
              ⌘K
            </span>
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search stories, entities, topics — or jump to a page"
              className="flex-1 bg-transparent text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
            {loading && (
              <span className="text-xs text-slate-500" aria-live="polite">
                searching…
              </span>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-slate-500 hover:text-slate-300"
              aria-label="Close"
            >
              Esc
            </button>
          </div>
          <Command.List className="max-h-[60vh] overflow-y-auto p-2 text-sm">
            <Command.Empty className="px-3 py-6 text-center text-sm text-slate-500">
              {query.trim().length < 2
                ? "Type at least 2 characters…"
                : loading
                ? "Searching…"
                : "No matches."}
            </Command.Empty>

            {hits.length > 0 && (
              <>
                {(["story", "entity", "topic"] as const).map((kind) => {
                  const group = hits.filter((h) => h.kind === kind);
                  if (group.length === 0) return null;
                  const badge = KIND_BADGE[kind];
                  return (
                    <Command.Group
                      key={kind}
                      heading={
                        <span className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {badge.label}
                        </span>
                      }
                    >
                      {group.map((h) => (
                        <Command.Item
                          key={`${h.kind}-${h.id}`}
                          value={`${h.kind}-${h.label}-${h.id}`}
                          onSelect={() => navigate(h.href)}
                          className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-slate-300 data-[selected=true]:bg-cyan-500/10 data-[selected=true]:text-cyan-100"
                        >
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${badge.tone}`}
                          >
                            {badge.label}
                          </span>
                          <span className="flex-1 truncate">{h.label}</span>
                          <span className="shrink-0 text-xs text-slate-500">
                            {h.sublabel}
                          </span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  );
                })}
              </>
            )}

            <Command.Group
              heading={
                <span className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Go to
                </span>
              }
            >
              {PAGE_SHORTCUTS.map((p) => (
                <Command.Item
                  key={p.href}
                  value={`page-${p.label}`}
                  onSelect={() => navigate(p.href)}
                  className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-slate-300 data-[selected=true]:bg-cyan-500/10 data-[selected=true]:text-cyan-100"
                >
                  <span className="text-slate-500" aria-hidden>
                    →
                  </span>
                  <span className="flex-1">{p.label}</span>
                  {p.hint && (
                    <span className="font-mono text-[10px] text-slate-600">
                      {p.hint}
                    </span>
                  )}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
          <div className="flex items-center justify-between border-t border-white/5 px-4 py-2 text-[11px] text-slate-500">
            <span>
              <kbd className="rounded bg-slate-800/70 px-1.5 py-0.5 font-mono text-slate-400">↑↓</kbd>
              <span className="ml-1">navigate</span>
              <span className="mx-2 text-slate-700">·</span>
              <kbd className="rounded bg-slate-800/70 px-1.5 py-0.5 font-mono text-slate-400">↵</kbd>
              <span className="ml-1">open</span>
            </span>
            <span>
              press <kbd className="rounded bg-slate-800/70 px-1.5 py-0.5 font-mono text-slate-400">/</kbd> anywhere
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
