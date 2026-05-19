import Link from "next/link";

import TimeAgo from "@/components/TimeAgo";
import type { StoryListItem } from "@/lib/types";
import { countryFlag } from "@/lib/format";

// Horizontal strip of stories that just lit up — fresh enough to be "now"
// and multi-sourced enough to be real. Renders compact cards instead of the
// full StoryCard so 4-6 fit across without crowding the rest of the page.

export default function BreakingNow({ stories }: { stories: StoryListItem[] }) {
  if (stories.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        Nothing breaking in the last 2 hours. The dashboard auto-refreshes every 30s.
      </div>
    );
  }
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
      {stories.map((s) => (
        <Link
          key={s.id}
          href={`/stories/${s.id}`}
          className="group relative min-w-[260px] max-w-[300px] shrink-0 snap-start overflow-hidden rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/10 via-slate-950/60 to-slate-950/80 p-4 transition hover:border-rose-400/50"
        >
          {/* Pulsing dot in the corner so the eye is drawn to the strip */}
          <span className="absolute right-3 top-3 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-400" />
          </span>

          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-300/90">
            Breaking
          </div>
          <h4 className="mt-1.5 line-clamp-3 text-sm font-semibold text-slate-100 group-hover:text-rose-100">
            {s.name}
          </h4>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
            <span className="rounded-full bg-rose-500/10 px-2 py-0.5 font-mono text-rose-200">
              ↑ {s.source_count}
            </span>
            <span>outlets</span>
            <span className="text-slate-600">·</span>
            <TimeAgo iso={s.last_updated_at} />
            <span className="ml-auto text-base" title={s.primary_country ?? ""}>
              {countryFlag(s.primary_country)}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
