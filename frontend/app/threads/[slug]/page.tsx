import Link from "next/link";
import { notFound } from "next/navigation";

import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import TimeAgo from "@/components/TimeAgo";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let thread;
  try {
    thread = await api.getThread(slug);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Link href="/threads" className="mb-4 inline-block text-sm text-slate-400 hover:text-cyan-300">
        ← All threads
      </Link>
      <PageHeader
        eyebrow={`${thread.story_count} stories · ${thread.status}`}
        title={`🧵 ${thread.name}`}
        description={<>Started <TimeAgo iso={thread.first_seen_at} /> · last update <TimeAgo iso={thread.last_updated_at} /></>}
      />
      <Panel title="Timeline of stories">
        <div className="space-y-3">
          {thread.stories.map((s) => (
            <Link
              key={s.id}
              href={`/stories/${s.id}`}
              className="block rounded-xl border border-slate-800 bg-slate-950/40 p-3 hover:border-cyan-500/40"
            >
              <div className="text-xs text-slate-500">
                <TimeAgo iso={s.first_seen_at} /> · {s.source_count} outlets · {s.role}
              </div>
              <div className="mt-1 text-sm text-slate-100">{s.name}</div>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}
