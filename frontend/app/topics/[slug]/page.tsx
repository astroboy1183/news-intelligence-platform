import Link from "next/link";
import { notFound } from "next/navigation";

import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import Pill from "@/components/Pill";
import TimeAgo from "@/components/TimeAgo";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function TopicDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let topic;
  try {
    topic = await api.getTopic(slug);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Link href="/" className="mb-4 inline-block text-sm text-slate-400 hover:text-cyan-300">
        ← Back
      </Link>

      <PageHeader
        eyebrow="Topic"
        title={`#${topic.name}`}
        description={`${topic.article_count_7d} articles (last 7 days)`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Recent stories">
            {topic.recent_stories.length === 0 ? (
              <p className="text-sm text-slate-500">No recent stories.</p>
            ) : (
              <div className="space-y-2">
                {topic.recent_stories.map((s) => (
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
        </div>

        <Panel title="Related topics">
          <div className="flex flex-wrap gap-2">
            {topic.related_topics.map((t) => (
              <Pill key={t}>#{t}</Pill>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
