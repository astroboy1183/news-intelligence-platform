"use client";

import { useState } from "react";

import { api } from "@/lib/api";
import type { CoverageReport } from "@/lib/types";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; report: CoverageReport }
  | { kind: "error"; message: string };

export default function CoverageCell({ slug }: { slug: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [showMissing, setShowMissing] = useState(false);

  const run = async () => {
    setState({ kind: "loading" });
    setShowMissing(false);
    try {
      const report = await api.sourceCoverage(slug);
      setState({ kind: "ok", report });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Failed" });
    }
  };

  if (state.kind === "idle") {
    return (
      <button
        onClick={run}
        className="rounded-md border border-slate-700 bg-slate-900/40 px-2 py-1 text-[10px] font-medium text-slate-400 transition hover:border-cyan-400/40 hover:text-cyan-300"
      >
        Check
      </button>
    );
  }

  if (state.kind === "loading") {
    return <span className="text-[11px] text-cyan-300">checking…</span>;
  }

  if (state.kind === "error") {
    return (
      <span className="text-[11px] text-rose-300" title={state.message}>
        error · <button onClick={run} className="underline">retry</button>
      </span>
    );
  }

  const r = state.report;
  const pct = Math.round(r.coverage_pct * 100);
  const tone =
    pct >= 95
      ? "text-emerald-300"
      : pct >= 70
      ? "text-amber-300"
      : "text-rose-300";
  const dotTone =
    pct >= 95 ? "bg-emerald-400" : pct >= 70 ? "bg-amber-400" : "bg-rose-400";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dotTone}`} />
        <span className={`text-xs font-semibold ${tone}`}>{pct}%</span>
        <span className="text-[10px] text-slate-500">
          {r.in_db}/{r.unique_in_feed}
        </span>
        <button
          onClick={run}
          className="text-[10px] text-slate-500 hover:text-cyan-300"
          title="Re-check"
        >
          ↻
        </button>
      </div>
      {r.missing.length > 0 && (
        <button
          onClick={() => setShowMissing((v) => !v)}
          className="text-[10px] text-rose-300/80 hover:text-rose-200"
        >
          {showMissing ? "hide" : `${r.missing.length} missing ↓`}
        </button>
      )}
      {showMissing && r.missing.length > 0 && (
        <ul className="max-w-[280px] space-y-1 rounded-md border border-rose-500/20 bg-rose-950/20 p-2 text-left text-[10px] text-slate-300">
          {r.missing.slice(0, 5).map((m) => (
            <li key={m.url} className="truncate">
              <a href={m.url} target="_blank" rel="noopener noreferrer" className="hover:text-rose-200">
                · {m.title}
              </a>
            </li>
          ))}
          {r.missing.length > 5 && (
            <li className="text-[10px] text-slate-500">+ {r.missing.length - 5} more</li>
          )}
        </ul>
      )}
    </div>
  );
}
