"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { toast } from "@/lib/toast";

const STORAGE_KEY = "nip:saved-views";

type SavedView = {
  name: string;
  query: string; // serialized query string (without leading ?)
  saved_at: string;
};

function readViews(): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeViews(views: SavedView[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
}

function describeQuery(q: string): string {
  // Friendlier label than raw query string so the dropdown reads like a sentence.
  const sp = new URLSearchParams(q);
  const parts: string[] = [];
  const region = sp.get("region");
  const state = sp.get("state");
  const sort = sp.get("sort");
  if (region) parts.push(region === "india" ? "🇮🇳" : "🌍");
  if (state) parts.push(`📍 ${state}`);
  if (sort && sort !== "trending") parts.push(`sort:${sort}`);
  return parts.join(" · ") || "default";
}

export default function SavedViews() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [views, setViews] = useState<SavedView[]>([]);
  const [open, setOpen] = useState(false);

  // Re-read on mount + window storage events so multi-tab edits stay in sync.
  useEffect(() => {
    setViews(readViews());
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === STORAGE_KEY) setViews(readViews());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const currentQuery = searchParams.toString();
  const currentDescription = describeQuery(currentQuery);
  const alreadySaved = views.some((v) => v.query === currentQuery);

  const saveCurrent = () => {
    if (!currentQuery) {
      toast("Pick some filters first — there's nothing to save in the default view.", {
        tone: "info",
      });
      return;
    }
    const defaultName = currentDescription;
    const name = window.prompt("Name this view:", defaultName);
    if (!name) return;
    const next: SavedView[] = [
      { name: name.trim().slice(0, 60), query: currentQuery, saved_at: new Date().toISOString() },
      ...views.filter((v) => v.query !== currentQuery),
    ].slice(0, 12); // cap to keep the dropdown manageable
    writeViews(next);
    setViews(next);
    toast(`Saved view "${name}"`, { tone: "success" });
    setOpen(false);
  };

  const remove = (q: string) => {
    const next = views.filter((v) => v.query !== q);
    writeViews(next);
    setViews(next);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-500/40 hover:text-cyan-200"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span aria-hidden>⭐</span>
          Views
          {views.length > 0 && (
            <span className="rounded-full bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-400">
              {views.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={saveCurrent}
          disabled={alreadySaved}
          title={alreadySaved ? "These filters are already saved." : "Save current filters"}
          className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900/40 disabled:text-slate-500"
        >
          {alreadySaved ? "✓ Saved" : "+ Save view"}
        </button>
      </div>
      {open && (
        <div
          role="menu"
          onMouseLeave={() => setOpen(false)}
          className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-xl border border-slate-700 bg-slate-950/95 shadow-2xl backdrop-blur"
        >
          <div className="border-b border-slate-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Saved views
          </div>
          {views.length === 0 ? (
            <div className="px-3 py-4 text-xs text-slate-500">
              No saved views yet. Pick some filters and click <em>Save view</em> to
              keep them one click away.
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {views.map((v) => (
                <li key={v.query} className="group flex items-stretch">
                  <button
                    onClick={() => {
                      router.push(`?${v.query}`);
                      setOpen(false);
                    }}
                    className="flex-1 px-3 py-2 text-left text-sm text-slate-200 hover:bg-cyan-500/10 hover:text-cyan-200"
                  >
                    <div className="truncate font-medium">{v.name}</div>
                    <div className="truncate text-xs text-slate-500">
                      {describeQuery(v.query)}
                    </div>
                  </button>
                  <button
                    onClick={() => remove(v.query)}
                    aria-label={`Delete view ${v.name}`}
                    className="px-2 text-slate-600 opacity-0 transition group-hover:opacity-100 hover:text-rose-300"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
