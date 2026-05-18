"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Calls `router.refresh()` on an interval. Used in the root layout so every
 * server-rendered page re-fetches its data periodically without a full reload.
 *
 * Re-render is server-side — no client state is lost, no scroll jump.
 *
 * Default interval is 30s. Pages that need faster live updates (Ingestion)
 * have their own per-component polling on top of this.
 */
export default function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [lastRefreshAt, setLastRefreshAt] = useState<number>(() => Date.now());
  const [now, setNow] = useState<number>(() => Date.now());

  // Schedule data refreshes.
  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
      setLastRefreshAt(Date.now());
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  // Tick the "Xs ago" counter every second so user can see it's alive.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const secsAgo = Math.max(0, Math.floor((now - lastRefreshAt) / 1000));

  return (
    <div
      className="pointer-events-none fixed bottom-3 right-3 z-30 flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-900/70 px-3 py-1.5 text-[10px] font-medium text-slate-400 shadow-lg backdrop-blur-md"
      title={`Auto-refreshing every ${Math.round(intervalMs / 1000)}s`}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
      </span>
      live · refreshed {secsAgo}s ago
    </div>
  );
}
