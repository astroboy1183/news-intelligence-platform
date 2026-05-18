import Link from "next/link";

const primary = [
  { href: "/", label: "Dashboard" },
  { href: "/brief", label: "Brief" },
  { href: "/threads", label: "Threads" },
  { href: "/insights", label: "Insights" },
  { href: "/trends", label: "Trends" },
  { href: "/map", label: "Map" },
];

const secondary = [
  { href: "/predictions", label: "Predictions" },
  { href: "/network", label: "Network" },
  { href: "/sources/intelligence", label: "Source Intel" },
  { href: "/sources", label: "Sources" },
  { href: "/ingestion", label: "Ingestion" },
];

export default function NavBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-slate-950/40 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-3">
        <Link href="/" className="flex items-center gap-2 text-base font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-500 text-slate-950 shadow-lg shadow-cyan-500/40 ring-1 ring-white/20">
            N
          </span>
          <span className="bg-gradient-to-r from-cyan-200 via-sky-300 to-purple-300 bg-clip-text text-transparent tracking-tight">
            NewsIntel
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-300">
          {primary.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-medium hover:text-cyan-300 transition-colors"
            >
              {l.label}
            </Link>
          ))}
          <span className="mx-1 text-slate-700">·</span>
          {secondary.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-slate-400 hover:text-cyan-300 transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
