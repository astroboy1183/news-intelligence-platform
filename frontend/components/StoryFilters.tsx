"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import FeedExport from "@/components/FeedExport";
import SavedViews from "@/components/SavedViews";
import { api } from "@/lib/api";
import type { StateRollup } from "@/lib/types";

type Region = "all" | "india" | "global";
type Sort = "trending" | "recent" | "most_covered";

const REGIONS: { value: Region; label: string; emoji: string }[] = [
  { value: "all", label: "All", emoji: "🌐" },
  { value: "india", label: "India", emoji: "🇮🇳" },
  { value: "global", label: "Global", emoji: "🌍" },
];

const SORTS: { value: Sort; label: string }[] = [
  { value: "trending", label: "Trending" },
  { value: "recent", label: "Recent" },
  { value: "most_covered", label: "Most covered" },
];

const QUICK_PICK_COUNT = 12;

export default function StoryFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const region = (searchParams.get("region") ?? "all") as Region;
  const state = searchParams.get("state") ?? "";
  const sort = (searchParams.get("sort") ?? "trending") as Sort;

  const [states, setStates] = useState<StateRollup[]>([]);

  useEffect(() => {
    let mounted = true;
    api.trendsByState({ days: 14 })
      .then((rows) => {
        if (mounted) setStates(rows);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const update = (changes: Partial<Record<"region" | "state" | "sort", string | null>>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "" || v === "all") {
        params.delete(k);
      } else {
        params.set(k, v);
      }
    }
    // Picking a state implies "India" — set region automatically.
    if (changes.state && changes.state !== "all" && changes.state !== "") {
      params.set("region", "india");
    }
    // Region switching off India clears state.
    if (changes.region !== undefined && changes.region !== "india") {
      params.delete("state");
    }
    startTransition(() => {
      router.push(params.toString() ? `?${params.toString()}` : "?");
    });
  };

  const stateOptions = useMemo(
    () => states.filter((r) => (r.story_count ?? 0) > 0),
    [states],
  );
  const quickPickStates = useMemo(
    () => stateOptions.slice(0, QUICK_PICK_COUNT),
    [stateOptions],
  );

  const filterActive = region !== "all" || !!state || sort !== "trending";

  return (
    <div className="mb-6 panel space-y-4">
      {/* Top row: region toggle + state dropdown + sort + clear */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Region
          </span>
          <div className="inline-flex rounded-xl border border-slate-700 bg-slate-900/40 p-0.5">
            {REGIONS.map((r) => {
              const active = region === r.value;
              return (
                <button
                  key={r.value}
                  onClick={() => update({ region: r.value })}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                    active
                      ? "bg-cyan-500/15 text-cyan-300 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.4)]"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span className="mr-1">{r.emoji}</span>
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            🇮🇳 State
          </span>
          <select
            value={state}
            onChange={(e) => update({ state: e.target.value })}
            className="rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-200 hover:border-cyan-500/40 focus:border-cyan-500/60 focus:outline-none"
          >
            <option value="">All states</option>
            {stateOptions.map((s) => (
              <option key={s.state} value={s.state}>
                {s.state} ({s.story_count})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Sort
          </span>
          <div className="inline-flex rounded-xl border border-slate-700 bg-slate-900/40 p-0.5">
            {SORTS.map((s) => {
              const active = sort === s.value;
              return (
                <button
                  key={s.value}
                  onClick={() => update({ sort: s.value })}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                    active
                      ? "bg-purple-500/15 text-purple-300 shadow-[inset_0_0_0_1px_rgba(168,85,247,0.4)]"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {pending && <span className="text-xs text-cyan-300">filtering…</span>}
          {filterActive && (
            <button
              onClick={() => update({ region: null, state: null, sort: null })}
              className="text-xs font-medium text-slate-400 underline-offset-4 hover:text-cyan-300 hover:underline"
            >
              Clear filters
            </button>
          )}
          <SavedViews />
          <FeedExport />
        </div>
      </div>

      {/* Quick-pick state chips (top 12 most-covered states this week) */}
      {quickPickStates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/60 pt-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Quick state picks
          </span>
          {quickPickStates.map((s) => {
            const active = state === s.state;
            return (
              <button
                key={s.state}
                onClick={() => update({ state: active ? null : s.state })}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "border-purple-400/60 bg-purple-500/15 text-purple-200 shadow-[0_0_12px_-2px_rgba(168,85,247,0.4)]"
                    : "border-slate-700 bg-slate-900/40 text-slate-300 hover:border-purple-400/40 hover:text-purple-300"
                }`}
              >
                📍 {s.state}
                <span className="ml-1.5 text-[10px] opacity-70">{s.story_count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
