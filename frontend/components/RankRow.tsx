import Link from "next/link";

export default function RankRow({
  rank,
  label,
  value,
  subtext,
  href,
}: {
  rank: number | string;
  label: string;
  value: string | number;
  subtext?: string;
  href?: string;
}) {
  const Body = (
    <div className="group flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-slate-800/50">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-800/60 text-[10px] font-mono font-semibold text-slate-400 transition group-hover:bg-cyan-500/20 group-hover:text-cyan-300">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-slate-100">{label}</div>
        {subtext && <div className="truncate text-xs text-slate-400">{subtext}</div>}
      </div>
      <span className="shrink-0 text-sm font-semibold text-cyan-400">{value}</span>
    </div>
  );
  return href ? <Link href={href}>{Body}</Link> : Body;
}
