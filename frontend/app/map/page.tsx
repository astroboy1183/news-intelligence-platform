import Link from "next/link";

import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import StateBarChart from "@/components/StateBarChart";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const states = await api.trendsByState({ days: 7 });
  const total = states.reduce((acc, s) => acc + s.story_count, 0);
  const sorted = [...states].sort((a, b) => b.story_count - a.story_count);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <PageHeader
        eyebrow="Geographic"
        title="India by state"
        description={`${total} stories tagged to ${states.length} states/UTs in the last 7 days. Click any state to drill down.`}
      />

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Panel title="Story density (top 15)">
          {states.length === 0 ? (
            <p className="text-sm text-slate-500">No state-tagged stories yet.</p>
          ) : (
            <StateBarChart rows={states} />
          )}
        </Panel>

        <Panel title="All states · drill in" subtitle="ranked by 7-day coverage">
          <div className="space-y-1">
            {sorted.map((s, i) => {
              const sharePct = total ? Math.round((s.story_count / total) * 100) : 0;
              return (
                <Link
                  key={s.state}
                  href={`/states/${encodeURIComponent(s.state)}`}
                  className="group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition hover:bg-cyan-500/10"
                >
                  <span className="w-7 text-right font-mono text-xs tabular-nums text-slate-500">
                    #{i + 1}
                  </span>
                  <span className="flex-1 truncate text-slate-100 group-hover:text-cyan-200">
                    {s.state}
                  </span>
                  <span className="w-12 text-right font-mono text-xs tabular-nums text-cyan-300">
                    {s.story_count}
                  </span>
                  <span className="w-10 text-right text-xs text-slate-500">
                    {sharePct}%
                  </span>
                </Link>
              );
            })}
            {sorted.length === 0 && (
              <div className="text-sm text-slate-500">
                No state-tagged stories in the last 7 days.
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
