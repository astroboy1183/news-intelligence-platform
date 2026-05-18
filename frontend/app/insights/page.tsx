import Link from "next/link";

import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import RankRow from "@/components/RankRow";
import TimeAgo from "@/components/TimeAgo";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

const ANOMALY_LABEL: Record<string, string> = {
  entity_surge: "⬆ surge",
  entity_silence: "⬇ silence",
  novel_entity: "✨ new",
  story_burst: "🔥 burst",
  coverage_gap: "🗺 gap",
};

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
        <Panel title="⚡ Anomalies (last 24h)">
          <ul className="space-y-2 text-sm">
            {summary.anomalies_today.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3">
                <span className="text-slate-300">
                  <span className="mr-2 text-slate-500">{ANOMALY_LABEL[a.type] ?? a.type}</span>
                  {a.href ? (
                    <Link href={a.href} className="text-slate-100 hover:text-cyan-300">
                      {a.label}
                    </Link>
                  ) : (
                    a.label
                  )}
                </span>
                <span className="shrink-0 text-cyan-400">{a.severity.toFixed(1)}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="🎯 First to break (24h)">
          <div className="space-y-1">
            {summary.first_to_break.map((b, i) => (
              <RankRow
                key={b.slug}
                rank={i + 1}
                label={b.name}
                value={b.stories_broken}
                subtext="stories first"
              />
            ))}
          </div>
        </Panel>

        <Panel title="🔇 Quiet but important">
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

        <Panel title="🗺 Coverage gaps">
          <div className="space-y-2 text-sm">
            {summary.coverage_gaps.map((g) => (
              <Link
                key={g.story_id}
                href={`/stories/${g.story_id}`}
                className="block rounded-xl border border-slate-800 bg-slate-950/40 p-3 hover:border-cyan-500/40"
              >
                <div className="text-slate-100">{g.name}</div>
                <div className="mt-1 text-xs text-slate-500">
                  IN: {g.in} · Global: {g.global} · {g.gap}
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
