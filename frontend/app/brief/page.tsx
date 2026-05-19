import Link from "next/link";

import AnomalyCard from "@/components/AnomalyCard";
import DeltaMetric from "@/components/DeltaMetric";
import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import { api } from "@/lib/api";
import { countryFlag } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BriefPage() {
  const brief = await api.brief();
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <PageHeader
        eyebrow={`Generated ${brief.generated_at.slice(0, 16).replace("T", " ")} UTC`}
        title="Your daily brief"
        description="Top 5 stories you should know, plus what changed and where signal is rising."
      />

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <DeltaMetric
          tone="cyan"
          title="New stories (24h)"
          value={brief.whats_changed.new}
          prev={brief.whats_changed_prev?.new ?? null}
          series={(brief.daily_series ?? []).map((p) => p.new_stories)}
          subtitle="first seen in last day"
        />
        <DeltaMetric
          tone="amber"
          title="Escalated"
          value={brief.whats_changed.escalated}
          prev={brief.whats_changed_prev?.escalated ?? null}
          series={(brief.daily_series ?? []).map((p) => p.escalated)}
          subtitle="≥5 outlets joined"
        />
        <DeltaMetric
          tone="emerald"
          title="Resolved"
          value={brief.whats_changed.resolved}
          prev={brief.whats_changed_prev?.resolved ?? null}
          subtitle="no coverage in 24h"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="📌 Top 5 stories you should know">
            <div className="space-y-3">
              {brief.top_stories.map((s, i) => (
                <Link
                  key={s.id}
                  href={`/stories/${s.id}`}
                  className="block rounded-2xl border border-slate-800 bg-slate-950/40 p-4 hover:border-cyan-500/40"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-slate-500">#{i + 1}</span>
                    <h3 className="text-base font-semibold text-slate-100">{s.name}</h3>
                    <span className="ml-auto text-xl">{countryFlag(s.primary_country)}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    ↑ {s.source_count} outlets{s.primary_state ? ` · 📍 ${s.primary_state}` : ""}
                  </div>
                  {s.tldr.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm text-slate-300">
                      {s.tldr.slice(0, 3).map((b, j) => (
                        <li key={j} className="line-clamp-2">• {b}</li>
                      ))}
                    </ul>
                  )}
                </Link>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="⚠ Anomalies">
            {brief.anomalies.length === 0 ? (
              <div className="text-sm text-slate-500">No anomalies right now.</div>
            ) : (
              <div className="grid gap-2">
                {brief.anomalies.slice(0, 6).map((a) => (
                  <AnomalyCard key={a.id} anomaly={a} compact />
                ))}
              </div>
            )}
          </Panel>
          <Panel title="🗺 Regional pulse (24h)">
            <ul className="space-y-1 text-sm">
              {brief.regional_pulse.map((r) => (
                <li key={r.state} className="flex justify-between">
                  <span className="text-slate-300">{r.state}</span>
                  <span className="text-cyan-400">{r.stories_24h}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
