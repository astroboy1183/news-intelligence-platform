import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import RankRow from "@/components/RankRow";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function SourceIntelPage() {
  const [breaking, overlap] = await Promise.all([
    api.sourceIntelBreaking({ days: 7, limit: 15 }),
    api.sourceIntelOverlap({ days: 30, limit: 25 }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <PageHeader
        eyebrow="Source intelligence"
        title="Who breaks first · who overlaps"
        description="Breaking power (last 7d) and source overlap by Jaccard on shared stories (last 30d)."
      />

      <div className="grid gap-6 lg:grid-cols-2">
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

        <Panel title="🤝 Highest source overlap" subtitle="Jaccard over shared story_ids">
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/60 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3 py-2">Source A</th>
                  <th className="px-3 py-2">Source B</th>
                  <th className="px-3 py-2 text-right">Shared</th>
                  <th className="px-3 py-2 text-right">Jaccard</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {overlap.map((r) => (
                  <tr key={`${r.a_slug}-${r.b_slug}`}>
                    <td className="px-3 py-2 text-slate-100">{r.a_slug}</td>
                    <td className="px-3 py-2 text-slate-100">{r.b_slug}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{r.shared_stories}</td>
                    <td className="px-3 py-2 text-right text-cyan-400">
                      {r.overlap.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
