import Link from "next/link";

import TimeAgo from "@/components/TimeAgo";
import type { StoryListItem } from "@/lib/types";
import { countryFlag } from "@/lib/format";

function velocityTier(score: number): "hot" | "warm" | "cool" {
  if (score >= 0.6) return "hot";
  if (score >= 0.3) return "warm";
  return "cool";
}

export default function StoryCard({
  story,
  size = "default",
}: {
  story: StoryListItem;
  size?: "default" | "hero";
}) {
  const tldr = story.tldr?.slice(0, size === "hero" ? 4 : 3) ?? [];
  const tier = velocityTier(story.velocity_score);
  const titleClass =
    size === "hero"
      ? "text-2xl font-bold leading-tight"
      : "text-base font-semibold leading-snug";

  return (
    <Link
      href={`/stories/${story.id}`}
      className={`pop-card pop-card-accent-${tier} block p-5 pl-6 group`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className={`${titleClass} text-slate-100 transition group-hover:text-cyan-300 line-clamp-3`}>
          {story.name}
        </h3>
        <span className="shrink-0 text-2xl leading-none" title={story.primary_country ?? ""}>
          {countryFlag(story.primary_country)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="chip">
          <span className={`dot dot-${tier}`} />
          {story.source_count} outlets
        </span>
        <span className="chip chip-muted">
          <TimeAgo iso={story.last_updated_at} />
        </span>
        {story.primary_state && (
          <span className="chip chip-state">📍 {story.primary_state}</span>
        )}
      </div>

      {tldr.length > 0 && (
        <ul className={`${size === "hero" ? "mt-4 text-base" : "mt-3 text-sm"} space-y-1.5 text-slate-300`}>
          {tldr.map((s, i) => (
            <li key={i} className="line-clamp-2 leading-relaxed">
              <span className="text-cyan-500/60 mr-1.5">•</span>
              {s}
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}
