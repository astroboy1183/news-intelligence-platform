import Link from "next/link";

import TimeAgo from "@/components/TimeAgo";
import type { ThreadStoryRef } from "@/lib/types";

// Two role values come out of the backend: "origin" (the seed story) and
// "escalation" (each subsequent story that joined the thread because it
// shared enough entities). We render them on a vertical spine with a node
// per story; size and tone change so the eye can read the narrative arc
// (small green dot → growing amber dots) at a glance.

const ROLE_META: Record<string, { label: string; tone: string; ring: string; dot: string }> = {
  origin: {
    label: "Origin",
    tone: "text-emerald-300",
    ring: "border-emerald-500/40 bg-emerald-500/10",
    dot: "bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.6)]",
  },
  escalation: {
    label: "Escalation",
    tone: "text-amber-300",
    ring: "border-amber-500/30 bg-amber-500/10",
    dot: "bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.55)]",
  },
};

function fallbackMeta(role: string) {
  return {
    label: role,
    tone: "text-slate-300",
    ring: "border-slate-700 bg-slate-800/40",
    dot: "bg-slate-400",
  };
}

export default function ThreadTimeline({ stories }: { stories: ThreadStoryRef[] }) {
  if (stories.length === 0) {
    return <div className="text-sm text-slate-500">No stories in this thread yet.</div>;
  }

  // Max source count drives the inline magnitude bar — gives a sense of
  // each escalation's reach without needing a separate chart.
  const maxSources = stories.reduce((m, s) => Math.max(m, s.source_count), 1);

  return (
    <div className="relative">
      {/* Vertical spine */}
      <div className="pointer-events-none absolute left-[18px] top-2 bottom-2 w-px bg-gradient-to-b from-emerald-400/40 via-amber-400/40 to-amber-400/10" />
      <ol className="space-y-4">
        {stories.map((s, i) => {
          const meta = ROLE_META[s.role] ?? fallbackMeta(s.role);
          const barPct = Math.max(8, Math.round((s.source_count / maxSources) * 100));
          return (
            <li key={s.id} className="relative flex items-stretch gap-4 pl-1">
              {/* Node dot on the spine */}
              <div className="relative z-10 flex w-9 shrink-0 justify-center">
                <span
                  className={`mt-1.5 inline-block h-3 w-3 rounded-full ring-2 ring-slate-950 ${meta.dot}`}
                  aria-hidden
                />
              </div>
              <Link
                href={`/stories/${s.id}`}
                className="group flex-1 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 transition hover:border-cyan-500/40"
              >
                <div className="flex flex-wrap items-baseline gap-2 text-xs">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.ring} ${meta.tone}`}
                  >
                    {meta.label}
                  </span>
                  <span className="text-slate-400">
                    Step {i + 1} of {stories.length}
                  </span>
                  <span className="ml-auto text-slate-400">
                    <TimeAgo iso={s.first_seen_at} />
                  </span>
                </div>
                <h4 className="mt-2 text-sm font-medium text-slate-100 group-hover:text-cyan-200">
                  {s.name}
                </h4>
                {/* Coverage magnitude bar */}
                <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="font-mono tabular-nums text-slate-300">
                    {s.source_count}
                  </span>
                  <span>outlets</span>
                  <div className="ml-2 h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800/60">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400/70 to-violet-400/70"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
