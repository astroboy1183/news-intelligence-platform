// Metric card with a delta arrow vs the prior period plus a 7-day inline
// sparkline. The sparkline is hand-drawn SVG (no recharts dep) because we
// only need ~7 points and want it to fit in the same height as the value.

type Tone = "cyan" | "purple" | "emerald" | "amber" | "rose";

const TONE_NUM: Record<Tone, string> = {
  cyan: "text-cyan-300",
  purple: "text-purple-300",
  emerald: "text-emerald-300",
  amber: "text-amber-300",
  rose: "text-rose-300",
};
const TONE_STROKE: Record<Tone, string> = {
  cyan: "#22d3ee",
  purple: "#c4b5fd",
  emerald: "#6ee7b7",
  amber: "#fcd34d",
  rose: "#fda4af",
};

function fmtDelta(now: number, prev: number | undefined | null): {
  text: string;
  tone: "up" | "down" | "flat";
} {
  if (prev == null) return { text: "—", tone: "flat" };
  if (prev === 0 && now === 0) return { text: "0", tone: "flat" };
  if (prev === 0) return { text: `+${now}`, tone: "up" };
  const pct = Math.round(((now - prev) / prev) * 100);
  if (pct === 0) return { text: "0%", tone: "flat" };
  return { text: `${pct > 0 ? "+" : ""}${pct}%`, tone: pct > 0 ? "up" : "down" };
}

function Sparkline({ points, stroke }: { points: number[]; stroke: string }) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = Math.max(1, max - min);
  const W = 80;
  const H = 22;
  const stepX = W / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = i * stepX;
      const y = H - ((p - min) / range) * H;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  // Area fill for the gradient feel.
  const areaPath = `${path} L${W},${H} L0,${H} Z`;
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden
      className="overflow-visible"
    >
      <path d={areaPath} fill={stroke} opacity={0.15} />
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" />
      <circle
        cx={W}
        cy={H - ((points[points.length - 1] - min) / range) * H}
        r={2}
        fill={stroke}
      />
    </svg>
  );
}

type Props = {
  title: string;
  value: number;
  prev?: number | null;
  series?: number[];
  tone?: Tone;
  subtitle?: string;
};

export default function DeltaMetric({
  title,
  value,
  prev,
  series,
  tone = "cyan",
  subtitle,
}: Props) {
  const delta = fmtDelta(value, prev);
  const deltaClass =
    delta.tone === "up"
      ? "text-emerald-300"
      : delta.tone === "down"
      ? "text-rose-300"
      : "text-slate-500";
  const arrow = delta.tone === "up" ? "▲" : delta.tone === "down" ? "▼" : "·";

  return (
    <div className={`metric-card tone-${tone}`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {title}
        </div>
        {series && series.length >= 2 && (
          <Sparkline points={series} stroke={TONE_STROKE[tone]} />
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className={`text-4xl font-bold leading-none tracking-tight ${TONE_NUM[tone]}`}>
          {value.toLocaleString()}
        </div>
        <div className={`text-xs font-semibold ${deltaClass}`}>
          {arrow} {delta.text}
          <span className="ml-1 text-slate-500">vs yesterday</span>
        </div>
      </div>
      {subtitle && <div className="mt-2 text-xs text-slate-400">{subtitle}</div>}
    </div>
  );
}
