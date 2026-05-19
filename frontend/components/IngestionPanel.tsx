"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import MetricCard from "@/components/MetricCard";
import Panel from "@/components/Panel";
import TimeAgo from "@/components/TimeAgo";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { IngestionRunItem, IngestionSummary } from "@/lib/types";

const REFRESH_INTERVAL_MS = 8_000;

const STATUS_STYLE: Record<string, string> = {
  ok: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  not_modified: "bg-slate-500/10 text-slate-300 border-slate-500/30",
  error: "bg-rose-500/10 text-rose-300 border-rose-500/30",
  running: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  skipped_inactive: "bg-slate-500/10 text-slate-500 border-slate-500/20",
};

function StatusBadge({ status }: { status: string }) {
  const klass = STATUS_STYLE[status] ?? STATUS_STYLE.not_modified;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${klass}`}>
      {status}
    </span>
  );
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1_000) return `${ms}ms`;
  return `${(ms / 1_000).toFixed(2)}s`;
}

export default function IngestionPanel({
  initialSummary,
  initialRuns,
}: {
  initialSummary: IngestionSummary;
  initialRuns: IngestionRunItem[];
}) {
  const [summary, setSummary] = useState<IngestionSummary>(initialSummary);
  const [runs, setRuns] = useState<IngestionRunItem[]>(initialRuns);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  // Pause polling while the tab is hidden — matches AutoRefresh behavior.
  // Also we only surface error toasts after N consecutive failures so a
  // single network blip doesn't spam the user; counter resets on success.
  const consecFailRef = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        api.ingestionSummary(),
        api.ingestionRuns({ status: statusFilter || undefined, page_size: 50 }),
      ]);
      setSummary(s);
      setRuns(r.items);
      setLastRefreshed(new Date());
      consecFailRef.current = 0;
    } catch (e) {
      consecFailRef.current += 1;
      // First two failures are silent (transient). After that we tell the user
      // so they know the table isn't quietly stale.
      if (consecFailRef.current === 3) {
        toast(
          `Ingestion data isn't refreshing — ${
            e instanceof Error ? e.message : "unknown error"
          }`,
          { tone: "error" },
        );
      }
    }
  }, [statusFilter]);

  useEffect(() => {
    refresh();
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      refresh();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const handleTrigger = async () => {
    setTriggering(true);
    setTriggerMsg(null);
    try {
      const res = await api.triggerIngestion();
      setTriggerMsg(res.message);
      toast(res.message, { tone: res.status === "started" ? "success" : "info" });
      // immediate optimistic refresh, then a follow-up after a few seconds
      setTimeout(refresh, 1_500);
      setTimeout(refresh, 4_000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Trigger failed";
      setTriggerMsg(msg);
      toast(`Trigger failed: ${msg}`, { tone: "error" });
    } finally {
      setTriggering(false);
    }
  };

  const successPct = summary.runs_last_24h
    ? Math.round(
        ((summary.success_count_24h + summary.not_modified_24h) / summary.runs_last_24h) * 100,
      )
    : 0;

  return (
    <div className="space-y-6">
      {/* Trigger panel */}
      <Panel
        title="⚡ Trigger ingestion now"
        subtitle="Runs a one-off pass across all active sources (~30s). Schedules continue running every 2 min in the background."
        action={
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              Auto-refresh · <TimeAgo iso={lastRefreshed.toISOString()} />
            </span>
            <button
              onClick={handleTrigger}
              disabled={triggering || summary.ingestion_running}
              className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {summary.ingestion_running
                ? "Running…"
                : triggering
                ? "Triggering…"
                : "▶ Run ingestion now"}
            </button>
          </div>
        }
      >
        <p className="text-xs text-slate-400">
          Dedup is handled at two layers: URL canonicalization strips tracking params
          (<code className="rounded bg-slate-800/60 px-1 text-cyan-300">utm_*</code>,{" "}
          <code className="rounded bg-slate-800/60 px-1 text-cyan-300">fbclid</code>,{" "}
          <code className="rounded bg-slate-800/60 px-1 text-cyan-300">gclid</code>, …)
          before SHA-256 hashing, and inserts use{" "}
          <code className="rounded bg-slate-800/60 px-1 text-cyan-300">
            ON CONFLICT (url_hash) DO NOTHING
          </code>
          . Same article won&apos;t be re-ingested even from different sources or query params.
        </p>
        {triggerMsg && (
          <p className="mt-3 text-sm text-cyan-300">{triggerMsg}</p>
        )}
      </Panel>

      {/* Summary metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          tone="cyan"
          title="Runs last hour"
          value={summary.runs_last_hour.toLocaleString()}
          subtitle={`${summary.runs_last_24h.toLocaleString()} in last 24h`}
        />
        <MetricCard
          tone="emerald"
          title="Success rate (24h)"
          value={`${successPct}%`}
          subtitle={`${summary.success_count_24h} ok · ${summary.not_modified_24h} 304 · ${summary.error_count_24h} err`}
        />
        <MetricCard
          tone="purple"
          title="Articles ingested (24h)"
          value={summary.articles_inserted_24h.toLocaleString()}
          subtitle={`${summary.articles_skipped_24h.toLocaleString()} deduped`}
        />
        <MetricCard
          tone="amber"
          title="Avg duration"
          value={fmtDuration(summary.avg_duration_ms)}
          subtitle={`${summary.sources_active}/${summary.sources_total} sources active`}
        />
      </div>

      {/* Runs table */}
      <Panel
        title="📋 Recent runs"
        subtitle={<>Last ingest: <TimeAgo iso={summary.last_run_at} /></>}
        action={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-300"
          >
            <option value="">All statuses</option>
            <option value="ok">ok</option>
            <option value="not_modified">not_modified</option>
            <option value="error">error</option>
            <option value="running">running</option>
          </select>
        }
      >
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-slate-900/60 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Started</th>
                <th className="px-3 py-2 text-right">Duration</th>
                <th className="px-3 py-2 text-right">Seen</th>
                <th className="px-3 py-2 text-right">Inserted</th>
                <th className="px-3 py-2 text-right">Skipped (dup)</th>
                <th className="px-3 py-2">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {runs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                    No runs yet.
                  </td>
                </tr>
              )}
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-slate-900/40">
                  <td className="px-3 py-2 text-slate-100">{r.source_name}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2 text-slate-400"><TimeAgo iso={r.started_at} /></td>
                  <td className="px-3 py-2 text-right text-slate-300">{fmtDuration(r.duration_ms)}</td>
                  <td className="px-3 py-2 text-right text-slate-300">{r.articles_seen}</td>
                  <td className="px-3 py-2 text-right text-emerald-300">{r.articles_inserted}</td>
                  <td className="px-3 py-2 text-right text-slate-400">{r.articles_skipped}</td>
                  <td className="px-3 py-2 text-xs text-rose-300/80 max-w-[200px] truncate">
                    {r.error ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
