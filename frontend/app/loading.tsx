// Shown by Next.js during route-segment transitions and the initial server
// render of a slow page. Skeleton bars match the typical dashboard layout
// (hero + 4 metric cards + content grid) so the visual jump is minimal.
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8">
        <div className="mb-2 h-3 w-24 animate-pulse rounded bg-slate-800/70" />
        <div className="mb-2 h-8 w-72 animate-pulse rounded bg-slate-800/80" />
        <div className="h-3 w-96 max-w-full animate-pulse rounded bg-slate-800/50" />
      </div>
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl border border-slate-800/60 bg-slate-900/40"
          />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-slate-800/60 bg-slate-900/30"
            />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl border border-slate-800/60 bg-slate-900/30"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
