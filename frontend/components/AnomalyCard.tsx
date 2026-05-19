import Link from "next/link";

import TimeAgo from "@/components/TimeAgo";
import type { AnomalyItem } from "@/lib/types";

// Glyph + plain-language verb per type. The verb fronts the headline so the card
// reads as a sentence: "Surged · Modi · 42 mentions vs 5 baseline (8x normal)".
const META: Record<string, { glyph: string; verb: string; tone: string }> = {
  entity_surge:   { glyph: "⬆", verb: "Surged",        tone: "amber"   },
  entity_silence: { glyph: "⬇", verb: "Silenced",      tone: "slate"   },
  novel_entity:   { glyph: "✨", verb: "First detected", tone: "violet"  },
  story_burst:    { glyph: "🔥", verb: "Burst",          tone: "rose"    },
  coverage_gap:   { glyph: "🗺", verb: "Coverage gap",   tone: "cyan"    },
};

const TONE_RING: Record<string, string> = {
  amber:  "border-amber-500/30 hover:border-amber-400/50",
  slate:  "border-slate-700 hover:border-slate-500",
  violet: "border-violet-500/30 hover:border-violet-400/50",
  rose:   "border-rose-500/30 hover:border-rose-400/50",
  cyan:   "border-cyan-500/30 hover:border-cyan-400/50",
};
const TONE_TEXT: Record<string, string> = {
  amber:  "text-amber-300",
  slate:  "text-slate-300",
  violet: "text-violet-300",
  rose:   "text-rose-300",
  cyan:   "text-cyan-300",
};

function num(v: unknown, digits = 0): string | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

// Translate the raw payload into a one-line context string that a non-engineer can read.
// Returns null when we don't know how to format this type — caller falls back to severity.
function explain(a: AnomalyItem): string | null {
  const p = a.payload ?? {};
  switch (a.type) {
    case "entity_surge": {
      const recent = num(p.recent);
      const mean = num(p.mean, 1);
      const std = num(p.std, 1);
      if (recent == null || mean == null) return null;
      const ratio =
        typeof p.recent === "number" && typeof p.mean === "number" && p.mean > 0
          ? (p.recent / p.mean).toFixed(1)
          : null;
      const tail = std ? ` ± ${std}` : "";
      return ratio
        ? `${recent} mentions vs ${mean}${tail} baseline (${ratio}× normal)`
        : `${recent} mentions vs ${mean}${tail} baseline`;
    }
    case "entity_silence": {
      const recent = num(p.recent);
      const mean = num(p.mean, 1);
      if (recent == null || mean == null) return null;
      return `${recent} mentions today vs ${mean} typical — went quiet`;
    }
    case "novel_entity": {
      const recent = num(p.recent);
      return recent ? `First-ever detection — ${recent} mentions in 24h` : null;
    }
    case "story_burst": {
      const rs = num(p.recent_sources_4h);
      return rs ? `${rs} outlets picked it up in the last 4 hours` : null;
    }
    case "coverage_gap": {
      const inCt = num(p.in);
      const globalCt = num(p["global"]);
      const which = p.gap === "india_only" ? "India-only coverage" : "Global-only coverage";
      if (inCt == null || globalCt == null) return null;
      return `${which} — India: ${inCt} · Global: ${globalCt}`;
    }
    default:
      return null;
  }
}

type Props = { anomaly: AnomalyItem; compact?: boolean };

export default function AnomalyCard({ anomaly, compact = false }: Props) {
  const meta = META[anomaly.type] ?? { glyph: "•", verb: anomaly.type, tone: "slate" };
  const context = explain(anomaly);
  const inner = (
    <div
      className={`group flex flex-col gap-1.5 rounded-2xl border bg-slate-950/40 p-3 transition ${TONE_RING[meta.tone]}`}
    >
      <div className="flex items-baseline gap-2">
        <span className={`text-base ${TONE_TEXT[meta.tone]}`} aria-hidden>
          {meta.glyph}
        </span>
        <span className={`text-xs font-medium uppercase tracking-wider ${TONE_TEXT[meta.tone]}`}>
          {meta.verb}
        </span>
        <span className="ml-auto text-xs text-slate-500">
          <TimeAgo iso={anomaly.detected_at} />
        </span>
      </div>
      <div className="text-sm font-semibold text-slate-100 group-hover:text-cyan-200">
        {anomaly.label}
      </div>
      {context && !compact && (
        <div className="text-xs text-slate-400">{context}</div>
      )}
      {!compact && (
        <div className="flex items-center justify-between pt-1">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            severity <span className="text-slate-300">{anomaly.severity.toFixed(1)}</span>
          </div>
          {anomaly.href && (
            <span className="text-[10px] uppercase tracking-wider text-cyan-400/70 group-hover:text-cyan-300">
              drill in →
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (anomaly.href) {
    return (
      <Link href={anomaly.href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}
