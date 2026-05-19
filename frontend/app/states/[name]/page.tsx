import Link from "next/link";
import { notFound } from "next/navigation";

import MetricCard from "@/components/MetricCard";
import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import StoryCard from "@/components/StoryCard";
import TimeAgo from "@/components/TimeAgo";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

// Drill-down for a single Indian state. The URL slug is the URL-encoded state
// name (e.g. "Tamil Nadu" → "Tamil%20Nadu"). We resolve it case-insensitively
// against the rollup so links from anywhere (chips, badges, brief regional
// pulse) all land on the same canonical page.

export default async function StatePage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name: rawName } = await params;
  const decoded = decodeURIComponent(rawName);

  // Get the rollup so we can show "rank N of M" context + find canonical name.
  const rollup = await api.trendsByState({ days: 14 });
  const match = rollup.find(
    (r) => r.state.toLowerCase() === decoded.toLowerCase(),
  );
  if (!match) notFound();

  const sorted = [...rollup].sort((a, b) => b.story_count - a.story_count);
  const rank = sorted.findIndex((r) => r.state === match.state) + 1;
  const totalStates = sorted.length;
  const totalStoriesAcrossStates = sorted.reduce((s, r) => s + r.story_count, 0);
  const sharePct = totalStoriesAcrossStates
    ? Math.round((match.story_count / totalStoriesAcrossStates) * 100)
    : 0;

  // Fetch the actual stories tagged to this state.
  const [stories, recentStories] = await Promise.all([
    api.listStories({
      state: match.state,
      region: "india",
      sort: "most_covered",
      page_size: 24,
    }),
    api.listStories({
      state: match.state,
      region: "india",
      sort: "recent",
      since_hours: 24,
      min_sources: 1,
      page_size: 10,
    }),
  ]);

  // Neighbor states ranked just above/below us for navigation flavor.
  const nearby = sorted.slice(
    Math.max(0, rank - 4),
    Math.min(sorted.length, rank + 3),
  );

  const [hero, ...rest] = stories.items;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Link
        href="/map"
        className="mb-4 inline-block text-sm text-slate-400 hover:text-cyan-300"
      >
        ← Back to map
      </Link>
      <PageHeader
        eyebrow={`India · State drill-down · rank #${rank} of ${totalStates}`}
        title={`📍 ${match.state}`}
        description={`${match.story_count.toLocaleString()} stories tagged to ${match.state} in the last 14 days — about ${sharePct}% of all state-tagged coverage.`}
      />

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard
          tone="cyan"
          title="Stories (14d)"
          value={match.story_count.toLocaleString()}
          subtitle="tagged to this state"
        />
        <MetricCard
          tone="purple"
          title="Rank"
          value={`#${rank}`}
          subtitle={`of ${totalStates} active states`}
        />
        <MetricCard
          tone="emerald"
          title="Fresh (24h)"
          value={recentStories.total.toLocaleString()}
          subtitle="updated in last day"
        />
        <MetricCard
          tone="amber"
          title="Share"
          value={`${sharePct}%`}
          subtitle="of state-tagged stories"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {hero && (
            <Panel title="🏆 Most-covered story" subtitle="ranked by outlet count">
              <StoryCard story={hero} size="hero" />
            </Panel>
          )}

          {rest.length > 0 && (
            <Panel
              title={`More from ${match.state}`}
              subtitle={`${stories.total.toLocaleString()} total · showing top ${rest.length}`}
            >
              <div className="grid gap-4 md:grid-cols-2">
                {rest.map((s) => (
                  <StoryCard key={s.id} story={s} />
                ))}
              </div>
            </Panel>
          )}

          {stories.items.length === 0 && (
            <Panel title="No coverage yet">
              <p className="text-sm text-slate-400">
                No stories have been tagged to {match.state} in the last 14 days.
                Sources may not be regularly covering it, or our state-tagging
                heuristic hasn&apos;t matched any entity aliases yet.
              </p>
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel title="🆕 Fresh from this state" subtitle="updated in last 24h">
            {recentStories.items.length === 0 ? (
              <div className="text-sm text-slate-500">No fresh stories.</div>
            ) : (
              <div className="space-y-2">
                {recentStories.items.slice(0, 8).map((s) => (
                  <Link
                    key={s.id}
                    href={`/stories/${s.id}`}
                    className="block rounded-xl border border-slate-800 bg-slate-950/40 p-3 hover:border-cyan-500/40"
                  >
                    <div className="line-clamp-2 text-sm text-slate-100">{s.name}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {s.source_count} outlets · <TimeAgo iso={s.last_updated_at} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="📊 Nearby states by activity">
            <div className="space-y-1">
              {nearby.map((s, idx) => {
                const r = sorted.findIndex((x) => x.state === s.state) + 1;
                const active = s.state === match.state;
                return (
                  <Link
                    key={s.state}
                    href={`/states/${encodeURIComponent(s.state)}`}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm transition ${
                      active
                        ? "bg-cyan-500/10 text-cyan-200"
                        : "text-slate-300 hover:bg-slate-800/40 hover:text-slate-100"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-7 font-mono text-xs tabular-nums text-slate-500">
                        #{r}
                      </span>
                      <span>{s.state}</span>
                    </span>
                    <span className="font-mono text-xs tabular-nums text-cyan-300">
                      {s.story_count}
                    </span>
                  </Link>
                );
              })}
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
