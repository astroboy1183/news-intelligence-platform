import Link from "next/link";
import { notFound } from "next/navigation";

import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import Pill from "@/components/Pill";
import TimeAgo from "@/components/TimeAgo";
import { api } from "@/lib/api";
import { countryFlag } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const storyId = Number(id);
  if (!Number.isFinite(storyId)) notFound();

  let story;
  try {
    story = await api.getStory(storyId);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Link href="/" className="mb-4 inline-block text-sm text-slate-400 hover:text-cyan-300">
        ← Back to dashboard
      </Link>

      <PageHeader
        eyebrow={<>{story.source_count} outlets · first seen <TimeAgo iso={story.first_seen_at} /></>}
        title={story.name}
        description={`${countryFlag(story.primary_country)} ${story.primary_country ?? ""}${
          story.primary_state ? " · 📍 " + story.primary_state : ""
        }`}
      />

      {story.tldr.length > 0 && (
        <Panel title="TL;DR">
          <ul className="space-y-2 text-sm text-slate-200">
            {story.tldr.map((b, i) => (
              <li key={i}>• {b}</li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Timeline" subtitle={`${story.articles.length} articles`}>
          <div className="space-y-3">
            {story.articles.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border border-slate-800 bg-slate-950/40 p-3 hover:border-cyan-500/40"
              >
                <div className="text-xs text-slate-500">
                  <TimeAgo iso={a.published_at ?? a.fetched_at} /> · {a.source_name}
                </div>
                <div className="mt-1 text-sm text-slate-100">{a.title}</div>
              </a>
            ))}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Entities">
            <div className="flex flex-wrap gap-2">
              {story.entities.map((e) => (
                <Link key={e.slug} href={`/entities/${encodeURIComponent(e.slug)}`}>
                  <Pill>
                    {e.type === "PERSON" ? "👤" : e.type === "ORG" ? "🏢" : "📍"} {e.name} · {e.mention_count}
                  </Pill>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="Topics">
            <div className="flex flex-wrap gap-2">
              {story.topics.map((t) => (
                <Link key={t.slug} href={`/topics/${encodeURIComponent(t.slug)}`}>
                  <Pill>#{t.name}</Pill>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="Coverage by country">
            <div className="space-y-1">
              {story.coverage_by_country.map((c) => (
                <div key={c.country} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">
                    {countryFlag(c.country)} {c.country}
                  </span>
                  <span className="text-cyan-400">{c.outlet_count} outlets</span>
                </div>
              ))}
            </div>
          </Panel>

          {story.first_reported_by_source_slug && (
            <Panel>
              <div className="text-xs text-slate-500">🥇 First reported by</div>
              <div className="text-sm text-slate-200">{story.first_reported_by_source_slug}</div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
