import { ReactNode } from "react";

export default function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800/40 px-3 py-1 text-xs text-slate-200 transition hover:border-cyan-500/40 hover:text-cyan-300 hover:bg-cyan-500/5">
      {children}
    </span>
  );
}
