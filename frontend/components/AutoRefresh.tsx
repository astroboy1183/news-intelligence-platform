"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Calls `router.refresh()` on an interval so every server-rendered page
 * re-fetches without a full reload.
 *
 * Design notes:
 *  - Pauses while the tab is hidden (saves Railway egress + battery; resumes
 *    on visibility with an immediate refresh so the user sees fresh data when
 *    they Alt-Tab back).
 *  - On router.refresh() throwing (network error), backs off exponentially
 *    1x → 2x → 4x (capped at 4x) to avoid hammering a degraded backend.
 *    Success resets the backoff.
 */
export default function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [lastRefreshAt, setLastRefreshAt] = useState<number>(() => Date.now());
  const [now, setNow] = useState<number>(() => Date.now());
  const [paused, setPaused] = useState<boolean>(false);
  const backoffRef = useRef<number>(1);
  const timerRef = useRef<number | null>(null);

  // Visibility pause: re-render so the indicator can show paused state.
  useEffect(() => {
    const onVis = () => {
      const hidden = document.hidden;
      setPaused(hidden);
      if (!hidden) {
        // Tab regained focus → fire one immediate refresh so the user sees
        // a fresh dashboard within ~100ms of returning, instead of waiting
        // out the rest of the prior interval.
        router.refresh();
        setLastRefreshAt(Date.now());
        backoffRef.current = 1;
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [router]);

  // The refresh loop is a self-scheduling timeout (not setInterval) so the
  // backoff multiplier can change between ticks.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (!document.hidden) {
        try {
          router.refresh();
          backoffRef.current = 1;
          setLastRefreshAt(Date.now());
        } catch {
          // router.refresh() itself doesn't throw, but if a future RSC fetch
          // surfaces an error here we double the interval (cap 4x = 2min @ 30s).
          backoffRef.current = Math.min(4, backoffRef.current * 2);
        }
      }
      if (!cancelled) {
        timerRef.current = window.setTimeout(tick, intervalMs * backoffRef.current);
      }
    };
    timerRef.current = window.setTimeout(tick, intervalMs);
    return () => {
      cancelled = true;
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, [router, intervalMs]);

  // Tick the "Xs ago" counter every second so user sees the indicator alive.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const secsAgo = Math.max(0, Math.floor((now - lastRefreshAt) / 1000));

  return (
    <div
      className="pointer-events-none fixed bottom-3 right-3 z-30 flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-900/70 px-3 py-1.5 text-[10px] font-medium text-slate-400 shadow-lg backdrop-blur-md"
      title={
        paused
          ? "Tab hidden — paused. Will refresh on focus."
          : `Auto-refreshing every ${Math.round((intervalMs * backoffRef.current) / 1000)}s`
      }
    >
      <span className="relative flex h-2 w-2">
        {!paused && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            paused ? "bg-slate-500" : "bg-cyan-400"
          }`}
        />
      </span>
      {paused ? (
        "paused"
      ) : (
        <>live · refreshed {secsAgo}s ago</>
      )}
    </div>
  );
}
