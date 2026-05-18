import Link from "next/link";
import { notFound } from "next/navigation";

import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import RankRow from "@/components/RankRow";
import TimeAgo from "@/components/TimeAgo";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function EntityDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let entity;
  try {
    entity = await api.getEntity(slug);
  } catch {
    notFound();
  }

  const icon =
    entity.type === "PERSON" ? "👤" : entity.type === "ORG" ? "🏢" : "📍";

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Link href="/" className="mb-4 inline-block text-sm text-slate-400 hover:text-cyan-300">
        ← Back
      </Link>

      <PageHeader
        eyebrow={`${icon} ${entity.type}`}
        title={entity.name}
        description={`${entity.mention_count_7d} mentions (last 7 days)`}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Recent stories">
          {entity.recent_stories.length === 0 ? (
            <p className="text-sm text-slate-500">No recent stories featuring this entity.</p>
          ) : (
            <div className="space-y-2">
              {entity.recent_stories.map((s) => (
                <Link
                  key={s.id}
                  href={`/stories/${s.id}`}
                  className="block rounded-xl border border-slate-800 bg-slate-950/40 p-3 hover:border-cyan-500/40"
                >
                  <div className="text-sm text-slate-100">{s.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {s.source_count} outlets · <TimeAgo iso={s.last_updated_at} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Related entities" subtitle="co-mentioned in same articles">
          <div className="space-y-1">
            {entity.related.map((r, i) => (
              <RankRow
                key={r.slug}
                rank={i + 1}
                label={r.name}
                value={r.cooccurrence}
                subtext={r.type}
                href={`/entities/${encodeURIComponent(r.slug)}`}
              />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
