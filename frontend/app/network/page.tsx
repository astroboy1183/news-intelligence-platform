import Link from "next/link";

import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function NetworkPage() {
  const graph = await api.network({ min_weight: 5, max_edges: 200 });

  // Build adjacency for a simple "neighborhoods" view.
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n] as const));
  const neighbors = new Map<number, Array<{ id: number; weight: number }>>();
  for (const e of graph.edges) {
    if (!neighbors.has(e.source)) neighbors.set(e.source, []);
    if (!neighbors.has(e.target)) neighbors.set(e.target, []);
    neighbors.get(e.source)!.push({ id: e.target, weight: e.weight });
    neighbors.get(e.target)!.push({ id: e.source, weight: e.weight });
  }

  const ranked = [...graph.nodes].sort((a, b) => b.weight - a.weight).slice(0, 30);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <PageHeader
        eyebrow="Entity graph"
        title="Network"
        description={`${graph.nodes.length} entities · ${graph.edges.length} co-mention edges (last 7 days)`}
      />
      <Panel title="Top entities by network weight" subtitle="click an entity to drill in">
        <div className="grid gap-3 md:grid-cols-2">
          {ranked.map((n) => {
            const top = (neighbors.get(n.id) ?? [])
              .sort((a, b) => b.weight - a.weight)
              .slice(0, 5)
              .map((r) => ({ ...r, node: nodeById.get(r.id) }))
              .filter((r) => r.node);
            return (
              <Link
                key={n.id}
                href={`/entities/${encodeURIComponent(n.slug)}`}
                className="block rounded-2xl border border-slate-800 bg-slate-950/40 p-4 hover:border-cyan-500/40"
              >
                <div className="flex items-baseline justify-between">
                  <div className="text-base font-semibold text-slate-100">{n.name}</div>
                  <div className="text-xs text-slate-500">{n.type} · w={n.weight}</div>
                </div>
                {top.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1 text-xs text-slate-400">
                    {top.map((r) => (
                      <span key={r.id} className="rounded-full bg-slate-800/60 px-2 py-0.5">
                        {r.node!.name} <span className="text-slate-500">×{r.weight}</span>
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
