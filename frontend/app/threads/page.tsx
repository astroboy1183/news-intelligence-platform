import Link from "next/link";

import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import TimeAgo from "@/components/TimeAgo";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function ThreadsPage() {
  const threads = await api.listThreads({ status: "active", page_size: 50 });
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <PageHeader
        eyebrow="Multi-day narratives"
        title="Threads"
        description={`${threads.total} active narrative threads stitched from clustered stories`}
      />
      <Panel title="Active threads">
        <div className="space-y-3">
          {threads.items.map((t) => (
            <Link
              key={t.id}
              href={`/threads/${encodeURIComponent(t.slug)}`}
              className="block rounded-2xl border border-slate-800 bg-slate-950/40 p-4 hover:border-cyan-500/40"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-100">🧵 {t.name}</h3>
                <span className="shrink-0 text-xs text-slate-500">
                  <TimeAgo iso={t.last_updated_at} />
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {t.story_count} stories · started <TimeAgo iso={t.first_seen_at} />
              </div>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}
