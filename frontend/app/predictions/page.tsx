import Link from "next/link";

import MetricCard from "@/components/MetricCard";
import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function PredictionsPage() {
  const [predictions, acc] = await Promise.all([
    api.predictionsRising({ min_confidence: 0.4, limit: 30 }),
    api.predictionsAccuracy(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <PageHeader
        eyebrow="Heuristic v1"
        title="🔮 Predicted risers"
        description="Low-coverage stories likely to reach ≥20 outlets in the next 24h."
      />

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <MetricCard title="Total scored" value={predictions.length} />
        <MetricCard
          title="Accuracy"
          value={acc.total ? `${(acc.accuracy * 100).toFixed(0)}%` : "n/a"}
          subtitle={`${acc.correct} / ${acc.total} resolved`}
        />
        <MetricCard
          title="Avg lead time"
          value={acc.avg_lead_hours ? `${acc.avg_lead_hours.toFixed(1)}h` : "—"}
        />
      </section>

      <Panel title="Top candidates by confidence">
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/60 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3 py-2">Story</th>
                <th className="px-3 py-2 text-right">Now</th>
                <th className="px-3 py-2 text-right">Predicted</th>
                <th className="px-3 py-2 text-right">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {predictions.map((p) => (
                <tr key={p.story_id}>
                  <td className="px-3 py-2">
                    <Link href={`/stories/${p.story_id}`} className="text-slate-100 hover:text-cyan-300">
                      {p.story_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-300">{p.source_count_now}</td>
                  <td className="px-3 py-2 text-right text-cyan-400">→ {p.predicted_outlets_24h}</td>
                  <td className="px-3 py-2 text-right text-slate-300">
                    {(p.confidence * 100).toFixed(0)}%
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
