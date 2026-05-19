import { ReactNode } from "react";

type Tone = "cyan" | "purple" | "emerald" | "amber";

const TONE_NUM: Record<Tone, string> = {
  cyan: "text-cyan-300",
  purple: "text-purple-300",
  emerald: "text-emerald-300",
  amber: "text-amber-300",
};

export default function MetricCard({
  title,
  value,
  subtitle,
  tone = "cyan",
}: {
  title: string;
  value: string | number;
  subtitle?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className={`metric-card tone-${tone}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {title}
      </div>
      <div className={`mt-2 text-4xl font-bold leading-none tracking-tight ${TONE_NUM[tone]}`}>
        {value}
      </div>
      {subtitle && (
        <div className="mt-2 text-xs text-slate-400">{subtitle}</div>
      )}
    </div>
  );
}
