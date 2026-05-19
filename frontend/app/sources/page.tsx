import CoverageCell from "@/components/CoverageCell";
import MetricCard from "@/components/MetricCard";
import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import TimeAgo from "@/components/TimeAgo";
import { api } from "@/lib/api";
import { countryFlag } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_GLYPH: Record<string, string> = {
  ok: "✓",
  not_modified: "✓",
  error: "✗",
  running: "…",
};

export default async function SourcesPage() {
  const [health, sources] = await Promise.all([
    api.sourcesHealth(),
    api.listSources({ page_size: 200 }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <PageHeader
        eyebrow="Ingestion"
        title="Sources"
        description={`${health.active} of ${health.total} sources active, polling every 2 min`}
      />

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard title="Active" value={`${health.active}/${health.total}`} subtitle="enabled feeds" />
        <MetricCard title="Healthy" value={health.healthy} subtitle="fetched < 1h ago" />
        <MetricCard title="Stale" value={health.stale} subtitle="not fetched in 1h" />
        <MetricCard
          title="Articles/hour"
          value={health.articles_per_hour.toFixed(0)}
          subtitle={<>last run: <TimeAgo iso={health.last_run_at} /></>}
        />
      </section>

      <Panel title="All sources" subtitle={`${sources.total} configured`}>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-900/60 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2">Region</th>
                <th className="px-3 py-2">Lean</th>
                <th className="px-3 py-2 text-right">24h</th>
                <th className="px-3 py-2">Last fetch</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-right">Coverage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sources.items.map((s) => (
                <tr key={s.slug} className={s.is_active ? "" : "opacity-50"}>
                  <td className="px-3 py-2">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-100 hover:text-cyan-300"
                    >
                      {s.name}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {countryFlag(s.country)} {s.country}
                  </td>
                  <td className="px-3 py-2 text-slate-400">{s.region ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-400">{s.political_lean}</td>
                  <td className="px-3 py-2 text-right text-slate-300">{s.articles_24h}</td>
                  <td className="px-3 py-2 text-slate-400"><TimeAgo iso={s.last_fetched_at} /></td>
                  <td className="px-3 py-2 text-center text-cyan-400">
                    {STATUS_GLYPH[s.last_run_status ?? ""] ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {s.is_active ? <CoverageCell slug={s.slug} /> : <span className="text-[10px] text-slate-600">inactive</span>}
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
