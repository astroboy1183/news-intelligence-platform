import Link from "next/link";

import TimeAgo from "@/components/TimeAgo";
import { api } from "@/lib/api";
import { countryFlag } from "@/lib/format";

export const dynamic = "force-dynamic";

// Iframe-friendly trending strip. No nav, no command palette, no
// auto-refresh badge (chrome components opt out via pathname.startsWith("/embed")).
// Designed to be dropped into a partner site at heights ~280px.
//
// Example: <iframe src="https://news-intel/embed/trending?state=Karnataka&limit=5"
//                  width="100%" height="280" loading="lazy" />

type EmbedSearchParams = {
  region?: "india" | "global";
  state?: string;
  country?: string;
  limit?: string;
  min_sources?: string;
  since_hours?: string;
  theme?: "dark" | "light";
};

export default async function EmbedTrendingPage({
  searchParams,
}: {
  searchParams: Promise<EmbedSearchParams>;
}) {
  const sp = await searchParams;
  const limit = Math.min(20, Math.max(1, Number(sp.limit ?? "6") || 6));
  const stories = await api.listStories({
    sort: "trending",
    region: sp.region,
    state: sp.state,
    country: sp.country,
    min_sources: Number(sp.min_sources ?? "2") || 2,
    since_hours: Number(sp.since_hours ?? "12") || 12,
    page_size: limit,
  });

  // Default to a "transparent over dark" look since the host page may pick
  // its own background. ?theme=light just tweaks foreground colors.
  const light = sp.theme === "light";
  const bgClass = light ? "bg-white text-slate-900" : "text-slate-100";

  const headerLabel = sp.state
    ? `📍 ${sp.state}`
    : sp.region === "india"
    ? "🇮🇳 India"
    : sp.region === "global"
    ? "🌍 Global"
    : "🌐 Trending";

  return (
    <div className={`min-h-screen p-3 ${bgClass}`}>
      <div className="mx-auto max-w-7xl">
        <header className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-60">
              Trending now
            </span>
            <span className="text-sm font-semibold">{headerLabel}</span>
          </div>
          <a
            href={`https://news-intelligence-platform.vercel.app/`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] uppercase tracking-wider opacity-60 hover:opacity-100"
          >
            NewsIntel ↗
          </a>
        </header>
        {stories.items.length === 0 ? (
          <div className={`rounded-xl border border-slate-700/40 p-4 text-sm ${light ? "" : "bg-slate-950/40"}`}>
            Nothing trending right now.
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {stories.items.map((s) => (
              <Link
                key={s.id}
                href={`/stories/${s.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`group min-w-[220px] max-w-[260px] shrink-0 rounded-xl border p-3 transition ${
                  light
                    ? "border-slate-200 bg-slate-50 hover:border-cyan-400"
                    : "border-slate-800 bg-slate-950/60 hover:border-cyan-500/40"
                }`}
              >
                <div className="flex items-center gap-1.5 text-[10px] opacity-70">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${light ? "bg-rose-500" : "bg-rose-400"}`} />
                  <span>{s.source_count} outlets</span>
                  <span>·</span>
                  <TimeAgo iso={s.last_updated_at} />
                  <span className="ml-auto text-sm" title={s.primary_country ?? ""}>
                    {countryFlag(s.primary_country)}
                  </span>
                </div>
                <h3 className={`mt-1.5 line-clamp-3 text-sm font-semibold ${light ? "group-hover:text-cyan-700" : "group-hover:text-cyan-200"}`}>
                  {s.name}
                </h3>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
