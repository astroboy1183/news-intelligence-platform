"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { toast } from "@/lib/toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Builds RSS + JSON Feed URLs for the dashboard's current filter combination
// and exposes them via a tiny popover. Reusing the API params means whatever
// the user is looking at in the dashboard, they can subscribe to in a reader
// without re-picking filters.

export default function FeedExport() {
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);

  const params = new URLSearchParams();
  for (const k of ["region", "state", "country", "sort", "min_sources", "since_hours"]) {
    const v = sp.get(k);
    if (v) params.set(k, v);
  }
  // Subscribers typically want a wider time window than the dashboard's 24h.
  if (!params.has("since_hours")) params.set("since_hours", "48");
  const qs = params.toString();
  const rssUrl = `${API_URL}/feeds/stories.rss${qs ? `?${qs}` : ""}`;
  const jsonUrl = `${API_URL}/feeds/stories.json${qs ? `?${qs}` : ""}`;

  const copy = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast(`${label} URL copied to clipboard`, { tone: "success" });
    } catch {
      toast("Couldn't access clipboard. Right-click → Copy link instead.", {
        tone: "error",
      });
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-500/40 hover:text-cyan-200"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Subscribe to this filter in your RSS reader"
      >
        <span aria-hidden>📡</span>
        Export
      </button>
      {open && (
        <div
          role="menu"
          onMouseLeave={() => setOpen(false)}
          className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-slate-700 bg-slate-950/95 p-3 shadow-2xl backdrop-blur"
        >
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Subscribe to current filters
          </div>
          {[
            { label: "RSS 2.0", url: rssUrl, hint: "Feedly, Inoreader, NetNewsWire" },
            { label: "JSON Feed", url: jsonUrl, hint: "n8n, IFTTT, scripts" },
          ].map((f) => (
            <div
              key={f.label}
              className="mb-2 rounded-lg border border-slate-800 bg-slate-900/40 p-2"
            >
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-slate-100">{f.label}</span>
                <span className="text-[10px] text-slate-500">{f.hint}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  readOnly
                  value={f.url}
                  className="flex-1 rounded bg-slate-950/80 px-2 py-1 font-mono text-[10px] text-slate-300"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={() => copy(f.url, f.label)}
                  className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:border-cyan-500/40 hover:text-cyan-200"
                >
                  copy
                </button>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-200 hover:bg-cyan-500/20"
                >
                  open
                </a>
              </div>
            </div>
          ))}
          <div className="mt-1 text-[10px] text-slate-500">
            Feeds cache for 60s. New stories appear within ~3 min of being clustered.
          </div>
        </div>
      )}
    </div>
  );
}
