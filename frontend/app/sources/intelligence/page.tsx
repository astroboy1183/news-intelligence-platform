import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import RankRow from "@/components/RankRow";
import SourceCompare from "@/components/SourceCompare";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function SourceIntelPage() {
  const [breaking, overlap, sources] = await Promise.all([
    api.sourceIntelBreaking({ days: 7, limit: 15 }),
    api.sourceIntelOverlap({ days: 30, limit: 25 }),
    api.listSources({ page_size: 200 }),
  ]);

  // Active sources only — comparing inactive ones produces empty results.
  const activeSources = sources.items.filter((s) => s.is_active);

  // The "highest overlap" table renders Jaccard as both a number and a
  // proportional bar so the relative sizes are scannable without parsing
  // decimal places.
  const maxOverlap = overlap.reduce((m, r) => Math.max(m, r.overlap), 0);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <PageHeader
        eyebrow="Source intelligence"
        title="Who breaks first · who agrees · who diverges"
        description="Breaking power (7d), pairwise Jaccard overlap (30d), and two-source drill-downs."
      />

      <Panel
        title="🤝 Compare two outlets"
        subtitle="What they agree on, and what each one missed"
      >
        <SourceCompare sources={activeSources} />
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="🎯 Breaking power" subtitle="stories first reported per source">
          <div className="space-y-1">
            {breaking.map((b, i) => (
              <RankRow
                key={b.slug}
                rank={i + 1}
                label={b.name}
                value={b.stories_broken}
                subtext="stories broken"
              />
            ))}
          </div>
        </Panel>

        <Panel title="🤝 Highest source overlap" subtitle="Jaccard over shared story_ids, last 30d">
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="bg-slate-900/60 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3 py-2">Source A</th>
                  <th className="px-3 py-2">Source B</th>
                  <th className="px-3 py-2 text-right">Shared</th>
                  <th className="px-3 py-2 text-right">Jaccard</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {overlap.map((r) => {
                  const pct = maxOverlap ? (r.overlap / maxOverlap) * 100 : 0;
                  return (
                    <tr key={`${r.a_slug}-${r.b_slug}`}>
                      <td className="px-3 py-2 text-slate-100">{r.a_slug}</td>
                      <td className="px-3 py-2 text-slate-100">{r.b_slug}</td>
                      <td className="px-3 py-2 text-right text-slate-300">{r.shared_stories}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800/70">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-400/70 to-violet-400/70"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-10 text-right font-mono tabular-nums text-cyan-300">
                            {r.overlap.toFixed(2)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
