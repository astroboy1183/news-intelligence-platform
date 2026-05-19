import Link from "next/link";
import { notFound } from "next/navigation";

import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import ThreadTimeline from "@/components/ThreadTimeline";
import TimeAgo from "@/components/TimeAgo";
import { api } from "@/lib/api";
import type { ThreadDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let thread: ThreadDetail;
  try {
    thread = await api.getThread(slug);
  } catch {
    notFound();
  }

  // Origin story is the earliest one with role "origin" (falls back to first).
  const origin = thread.stories.find((s) => s.role === "origin") ?? thread.stories[0];
  const escalationCount = thread.stories.filter((s) => s.role === "escalation").length;
  const totalOutlets = thread.stories.reduce((s, x) => s + x.source_count, 0);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link
        href="/threads"
        className="mb-4 inline-block text-sm text-slate-400 hover:text-cyan-300"
      >
        ← All threads
      </Link>
      <PageHeader
        eyebrow={`${thread.story_count} stories · ${thread.status}`}
        title={`🧵 ${thread.name}`}
        description={
          <>
            Started <TimeAgo iso={thread.first_seen_at} /> · last update{" "}
            <TimeAgo iso={thread.last_updated_at} />
          </>
        }
      />

      {/* Quick stats so the user reads the thread's "shape" before scanning */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
            Origin
          </div>
          {origin && (
            <Link
              href={`/stories/${origin.id}`}
              className="mt-1 line-clamp-2 block text-sm text-slate-100 hover:text-cyan-200"
            >
              {origin.name}
            </Link>
          )}
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">
            Escalations
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-amber-200">
            {escalationCount}
          </div>
          <div className="text-xs text-slate-400">subsequent stories joined</div>
        </div>
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
            Total reach
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-cyan-200">
            {totalOutlets}
          </div>
          <div className="text-xs text-slate-400">outlet-stories across the arc</div>
        </div>
      </div>

      <Panel title="Narrative arc" subtitle="origin → escalations, in chronological order">
        <ThreadTimeline stories={thread.stories} />
      </Panel>
    </div>
  );
}
