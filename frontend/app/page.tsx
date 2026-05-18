import Link from "next/link";

import MetricCard from "@/components/MetricCard";
import Panel from "@/components/Panel";
import Pill from "@/components/Pill";
import RankRow from "@/components/RankRow";
import StoryCard from "@/components/StoryCard";
import StoryFilters from "@/components/StoryFilters";
import TimeAgo from "@/components/TimeAgo";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DashboardSearchParams = {
  region?: "india" | "global";
  state?: string;
  sort?: "trending" | "recent" | "most_covered";
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const sp = await searchParams;
  const region = sp.region;
  const state = sp.state;
  const sort = sp.sort ?? "trending";

  const [stories, topics, entities, health] = await Promise.all([
    api.listStories({ sort, region, state, page_size: 13 }),
    api.listTopics({ page_size: 16 }),
    api.listEntities({ page_size: 10 }),
    api.sourcesHealth(),
  ]);

  const [hero, ...rest] = stories.items;
  const filterLabel = [
    region === "india" ? "🇮🇳 India" : region === "global" ? "🌍 Global" : null,
    state ? `📍 ${state}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-10">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
          {filterLabel ? `Filtered · ${filterLabel}` : "Personal Intelligence System"}
        </div>
        <h1 className="mt-2 bg-gradient-to-br from-white via-slate-100 to-slate-400 bg-clip-text text-5xl font-bold leading-tight tracking-tight text-transparent sm:text-6xl">
          The world&apos;s news,<br />
          <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-purple-300 bg-clip-text text-transparent">
            clustered into one signal.
          </span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-400">
          {stories.total.toLocaleString()} clustered stories · {entities.total.toLocaleString()} entities ·
          {" "}{topics.total.toLocaleString()} topics · {health.active}/{health.total} sources polling every 2 min
        </p>
      </header>

      <StoryFilters />

      <section className="mb-10 grid gap-4 md:grid-cols-4">
        <MetricCard tone="cyan" title="Stories" value={stories.total.toLocaleString()} subtitle={`${stories.items.length} on screen`} />
        <MetricCard tone="purple" title="Topics" value={topics.total.toLocaleString()} subtitle="extracted via KeyBERT" />
        <MetricCard tone="emerald" title="Entities" value={entities.total.toLocaleString()} subtitle="people, orgs, places" />
        <MetricCard
          tone="amber"
          title="Sources"
          value={`${health.active}/${health.total}`}
          subtitle={`${health.healthy} healthy · ${health.failing} failing · ${health.articles_per_hour.toFixed(0)} art/hr`}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {hero && (
            <Panel
              title="🔥 Featured story"
              subtitle="Trending #1 by velocity × source count"
            >
              <StoryCard story={hero} size="hero" />
            </Panel>
          )}

          <Panel
            title="Trending stories"
            subtitle={
              filterLabel
                ? `${stories.total} matching ${filterLabel}`
                : `${health.articles_per_hour.toFixed(0)} new articles/hour`
            }
          >
            {rest.length === 0 ? (
              <p className="text-sm text-slate-500">
                No stories yet — once enrichment + clustering finish, they appear here.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {rest.map((s) => (
                  <StoryCard key={s.id} story={s} />
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="🏷 Top topics" subtitle="last 7 days">
            <div className="flex flex-wrap gap-2">
              {topics.items.slice(0, 20).map((t) => (
                <Link key={t.slug} href={`/topics/${encodeURIComponent(t.slug)}`}>
                  <Pill>{t.name} · {t.article_count_7d}</Pill>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="👤 Top entities" subtitle="people, orgs, places">
            <div className="space-y-1">
              {entities.items.slice(0, 10).map((e, i) => (
                <RankRow
                  key={e.slug}
                  rank={i + 1}
                  label={e.name}
                  value={e.mention_count_7d}
                  subtext={e.type}
                  href={`/entities/${encodeURIComponent(e.slug)}`}
                />
              ))}
            </div>
          </Panel>

          <Panel title="🌐 Ingestion health">
            <ul className="space-y-1.5 text-sm text-slate-300">
              <li className="flex items-center justify-between">
                <span><span className="dot dot-cool mr-2 inline-block align-middle" /> Healthy</span>
                <span className="text-emerald-300 font-semibold">{health.healthy}</span>
              </li>
              <li className="flex items-center justify-between">
                <span><span className="dot dot-warm mr-2 inline-block align-middle" /> Stale (&gt;1h)</span>
                <span className="text-amber-300 font-semibold">{health.stale}</span>
              </li>
              <li className="flex items-center justify-between">
                <span><span className="dot dot-hot mr-2 inline-block align-middle" /> Failing</span>
                <span className="text-rose-300 font-semibold">{health.failing}</span>
              </li>
              <li className="border-t border-slate-800/60 pt-2 text-xs text-slate-500">
                Last ingest: <TimeAgo iso={health.last_run_at} />
              </li>
            </ul>
          </Panel>
        </div>
      </section>
    </div>
  );
}
