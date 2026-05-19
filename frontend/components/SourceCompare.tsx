"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { SourceCompareResult, SourceCompareStory, SourceItem } from "@/lib/types";

type Props = { sources: SourceItem[] };

function StoryRow({ s }: { s: SourceCompareStory }) {
  return (
    <Link
      href={`/stories/${s.id}`}
      className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2 text-xs hover:border-cyan-500/40"
    >
      <span className="flex-1 truncate text-slate-100">{s.name}</span>
      <span className="shrink-0 rounded-full bg-slate-800/70 px-2 py-0.5 font-mono text-[10px] text-slate-300">
        {s.source_count}
      </span>
    </Link>
  );
}

export default function SourceCompare({ sources }: Props) {
  // Default to the two most-active sources to give the user something
  // interesting on first load — empty state is unhelpful.
  const sortedSources = useMemo(
    () => [...sources].sort((a, b) => b.articles_24h - a.articles_24h),
    [sources],
  );
  const defaultA = sortedSources[0]?.slug ?? "";
  const defaultB = sortedSources[1]?.slug ?? "";

  const [a, setA] = useState(defaultA);
  const [b, setB] = useState(defaultB);
  const [data, setData] = useState<SourceCompareResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!a || !b || a === b) {
      setData(null);
      return;
    }
    setLoading(true);
    let cancelled = false;
    api
      .sourceIntelCompare({ a, b, days: 30, limit: 8 })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setData(null);
        toast(`Compare failed: ${e instanceof Error ? e.message : String(e)}`, {
          tone: "error",
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [a, b]);

  const jaccardPct = data ? Math.round(data.jaccard * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SourcePicker label="Source A" value={a} onChange={setA} options={sortedSources} />
        <span className="text-xl text-slate-600" aria-hidden>
          ↔
        </span>
        <SourcePicker label="Source B" value={b} onChange={setB} options={sortedSources} />
        {a === b && a && (
          <span className="text-xs text-amber-400">Pick two different sources</span>
        )}
      </div>

      {loading && !data && (
        <div className="text-sm text-slate-500">Comparing…</div>
      )}

      {data && (
        <>
          {/* Magnitude bar with proportional segments. Quickly conveys
              "these two sources agree on X% of stories" without doing
              percentile math. */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="mb-2 flex items-baseline justify-between text-xs">
              <span className="text-slate-400">
                Jaccard overlap (30d):{" "}
                <span className="text-cyan-300 font-mono tabular-nums">
                  {data.jaccard.toFixed(2)}
                </span>{" "}
                ({jaccardPct}%)
              </span>
              <span className="text-slate-500">
                {data.a.total_stories} vs {data.b.total_stories} stories covered
              </span>
            </div>
            <CompareBar
              aOnly={data.a_only_count}
              shared={data.shared_count}
              bOnly={data.b_only_count}
              aLabel={data.a.name}
              bLabel={data.b.name}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Bucket
              title={`Only in ${data.a.name}`}
              tone="cyan"
              count={data.a_only_count}
              stories={data.a_only}
            />
            <Bucket
              title="Shared"
              tone="violet"
              count={data.shared_count}
              stories={data.shared}
            />
            <Bucket
              title={`Only in ${data.b.name}`}
              tone="emerald"
              count={data.b_only_count}
              stories={data.b_only}
            />
          </div>
        </>
      )}
    </div>
  );
}

function SourcePicker({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: SourceItem[];
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-400">
      <span className="uppercase tracking-wider">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-sm text-slate-100 focus:border-cyan-500/60 focus:outline-none"
      >
        {options.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.name} ({s.country})
          </option>
        ))}
      </select>
    </label>
  );
}

function CompareBar({
  aOnly,
  shared,
  bOnly,
  aLabel,
  bLabel,
}: {
  aOnly: number;
  shared: number;
  bOnly: number;
  aLabel: string;
  bLabel: string;
}) {
  const total = Math.max(1, aOnly + shared + bOnly);
  const pct = (n: number) => (n / total) * 100;
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-900/60">
        <div
          className="h-full bg-cyan-500/70"
          style={{ width: `${pct(aOnly)}%` }}
          title={`Only ${aLabel}: ${aOnly}`}
        />
        <div
          className="h-full bg-violet-500/70"
          style={{ width: `${pct(shared)}%` }}
          title={`Shared: ${shared}`}
        />
        <div
          className="h-full bg-emerald-500/70"
          style={{ width: `${pct(bOnly)}%` }}
          title={`Only ${bLabel}: ${bOnly}`}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>
          <span className="inline-block h-2 w-2 rounded-sm bg-cyan-500/70" /> only {aLabel} ({aOnly})
        </span>
        <span>
          <span className="inline-block h-2 w-2 rounded-sm bg-violet-500/70" /> shared ({shared})
        </span>
        <span>
          <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500/70" /> only {bLabel} ({bOnly})
        </span>
      </div>
    </div>
  );
}

const TONE_RING: Record<string, string> = {
  cyan: "border-cyan-500/30 text-cyan-300",
  violet: "border-violet-500/30 text-violet-300",
  emerald: "border-emerald-500/30 text-emerald-300",
};

function Bucket({
  title,
  tone,
  count,
  stories,
}: {
  title: string;
  tone: "cyan" | "violet" | "emerald";
  count: number;
  stories: SourceCompareStory[];
}) {
  return (
    <div className={`rounded-2xl border bg-slate-950/40 p-3 ${TONE_RING[tone]}`}>
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider">{title}</div>
        <div className="text-base font-bold tabular-nums">{count}</div>
      </div>
      {stories.length === 0 ? (
        <div className="text-xs text-slate-500">No stories in this bucket.</div>
      ) : (
        <div className="space-y-1.5">
          {stories.map((s) => (
            <StoryRow key={s.id} s={s} />
          ))}
        </div>
      )}
    </div>
  );
}
