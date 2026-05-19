"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer on route change so it doesn't linger after navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-slate-950/40 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-bold"
          aria-label="NewsIntel home"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-500 text-slate-950 shadow-lg shadow-cyan-500/40 ring-1 ring-white/20">
            N
          </span>
          <span className="bg-gradient-to-r from-cyan-200 via-sky-300 to-purple-300 bg-clip-text text-transparent tracking-tight">
            NewsIntel
          </span>
        </Link>

        {/* Desktop nav: visible at lg+ to avoid wrapping at midsize screens. */}
        <nav className="ml-2 hidden flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-300 lg:flex">
          {primary.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`font-medium transition-colors hover:text-cyan-300 ${
                isActive(l.href) ? "text-cyan-300" : ""
              }`}
            >
              {l.label}
            </Link>
          ))}
          <span className="mx-1 text-slate-700">·</span>
          {secondary.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`transition-colors hover:text-cyan-300 ${
                isActive(l.href) ? "text-cyan-300" : "text-slate-400"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* ⌘K hint hides on small screens to keep mobile header compact. */}
          <span className="hidden items-center gap-1.5 rounded-full border border-slate-700/60 bg-slate-950/40 px-3 py-1 text-xs text-slate-500 md:inline-flex">
            <kbd className="font-mono">⌘K</kbd>
            <span className="text-slate-600">search</span>
          </span>

          {/* Mobile / tablet hamburger. */}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-700/60 bg-slate-950/40 text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-300 lg:hidden"
          >
            <span aria-hidden className="text-base leading-none">
              {open ? "✕" : "☰"}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile drawer panel. Slides under the header on < lg breakpoints. */}
      {open && (
        <nav
          id="mobile-nav"
          className="border-t border-white/5 bg-slate-950/85 backdrop-blur-2xl lg:hidden"
        >
          <div className="mx-auto grid max-w-7xl gap-1 px-6 py-3">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Primary
            </div>
            {primary.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`block rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive(l.href)
                    ? "bg-cyan-500/10 text-cyan-200"
                    : "text-slate-300 hover:bg-slate-800/60"
                }`}
              >
                {l.label}
              </Link>
            ))}
            <div className="mb-1 mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              More
            </div>
            {secondary.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`block rounded-xl px-3 py-2 text-sm transition ${
                  isActive(l.href)
                    ? "bg-cyan-500/10 text-cyan-200"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
