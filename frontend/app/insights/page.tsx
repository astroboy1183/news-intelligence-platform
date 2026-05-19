import Link from "next/link";

import AnomalyCard from "@/components/AnomalyCard";
import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import RankRow from "@/components/RankRow";
import TimeAgo from "@/components/TimeAgo";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const summary = await api.insightsSummary();
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <PageHeader
        eyebrow="Signal"
        title="Insights"
        description="Anomalies, first-to-break sources, quiet-but-important stories, and coverage gaps."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="⚡ Anomalies (last 24h)" subtitle="ranked by severity (z-score)">
          {summary.anomalies_today.length === 0 ? (
            <div className="text-sm text-slate-500">No anomalies in the last 24 hours.</div>
          ) : (
            <div className="grid gap-2">
              {summary.anomalies_today.map((a) => (
                <AnomalyCard key={a.id} anomaly={a} />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="🎯 First to break (24h)" subtitle="which outlets were earliest on each story">
          <div className="space-y-1">
            {summary.first_to_break.map((b, i) => (
              <RankRow
                key={b.slug}
                rank={i + 1}
                label={b.name}
                value={b.stories_broken}
                subtext="stories first"
                href={`/sources?focus=${encodeURIComponent(b.slug)}`}
              />
            ))}
          </div>
        </Panel>

        <Panel title="🔇 Quiet but important" subtitle="low-coverage stories with momentum">
          <div className="space-y-2 text-sm">
            {summary.quiet_but_important.map((s) => (
              <Link
                key={s.id}
                href={`/stories/${s.id}`}
                className="block rounded-xl border border-slate-800 bg-slate-950/40 p-3 hover:border-cyan-500/40"
              >
                <div className="text-slate-100">{s.name}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {s.source_count} outlets · <TimeAgo iso={s.last_updated_at} />
                </div>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="🗺 Coverage gaps" subtitle="stories covered by only one region">
          <div className="space-y-2 text-sm">
            {summary.coverage_gaps.map((g) => {
              const gapLabel =
                g.gap === "india_only"
                  ? "India-only"
                  : g.gap === "global_only"
                  ? "Global-only"
                  : g.gap;
              return (
                <Link
                  key={g.story_id}
                  href={`/stories/${g.story_id}`}
                  className="block rounded-xl border border-slate-800 bg-slate-950/40 p-3 hover:border-cyan-500/40"
                >
                  <div className="text-slate-100">{g.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-800/60 px-2 py-0.5 text-slate-300">
                      {gapLabel}
                    </span>
                    <span>India: <span className="text-slate-300">{g.in}</span></span>
                    <span>·</span>
                    <span>Global: <span className="text-slate-300">{g.global}</span></span>
                  </div>
                </Link>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
