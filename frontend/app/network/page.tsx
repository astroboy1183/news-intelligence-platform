import Link from "next/link";

import NetworkGraph from "@/components/NetworkGraph";
import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function NetworkPage() {
  const graph = await api.network({ min_weight: 5, max_edges: 250 });

  // Type breakdown for the legend chip row.
  const typeCounts: Record<string, number> = {};
  for (const n of graph.nodes) typeCounts[n.type] = (typeCounts[n.type] ?? 0) + 1;

  const ranked = [...graph.nodes].sort((a, b) => b.weight - a.weight).slice(0, 12);

  // Edge weight summary so the "wow factor" copy is grounded in real numbers.
  const totalEdgeWeight = graph.edges.reduce((s, e) => s + e.weight, 0);
  const strongestEdge = graph.edges.reduce(
    (m, e) => (e.weight > m ? e.weight : m),
    0,
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <PageHeader
        eyebrow="Entity graph"
        title="Network"
        description={`${graph.nodes.length} entities · ${graph.edges.length} co-mention edges (14-day window) · strongest tie ×${strongestEdge}`}
      />

      <div className="mb-6">
        <NetworkGraph nodes={graph.nodes} edges={graph.edges} height={640} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Panel title="Top entities by network weight" subtitle="click a row to drill in">
          <div className="grid gap-2 sm:grid-cols-2">
            {ranked.map((n, i) => (
              <Link
                key={n.id}
                href={`/entities/${encodeURIComponent(n.slug)}`}
                className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 hover:border-cyan-500/40"
              >
                <span className="w-6 text-right text-xs tabular-nums text-slate-500">
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-sm text-slate-100 group-hover:text-cyan-200">
                  {n.name}
                </span>
                <span className="text-xs uppercase tracking-wider text-slate-500">
                  {n.type}
                </span>
                <span className="w-12 text-right text-xs tabular-nums text-cyan-300">
                  {n.weight}
                </span>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="By entity type">
          <div className="space-y-2 text-sm">
            {Object.entries(typeCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([t, c]) => (
                <div
                  key={t}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2"
                >
                  <span className="uppercase tracking-wider text-slate-300">{t}</span>
                  <span className="text-cyan-300">{c}</span>
                </div>
              ))}
            <div className="pt-2 text-xs text-slate-500">
              Σ co-mention strength across all edges: <span className="text-slate-300">{totalEdgeWeight}</span>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
