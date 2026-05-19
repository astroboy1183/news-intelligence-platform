"use client";

import { useEffect } from "react";

// Global error boundary. Next.js renders this when any server-component page
// throws during a render. Without it, the user saw a blank screen until the
// next 30s AutoRefresh tried again — now they get an explanation and a
// one-click retry that re-runs the server render.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the browser console so the developer can grab the stack
    // even when Vercel logs are slow.
    // eslint-disable-next-line no-console
    console.error("page error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-6 py-24 text-center">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-2xl text-rose-300">
        ⚠
      </div>
      <h1 className="mb-2 text-2xl font-semibold text-slate-100">
        Something blew up rendering this page
      </h1>
      <p className="mb-1 text-sm text-slate-400">
        The API or the dashboard hit an unexpected error. Try again — most of the
        time this is a transient hiccup while Railway is redeploying.
      </p>
      {error.digest && (
        <p className="mb-6 font-mono text-xs text-slate-600">trace: {error.digest}</p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/20"
        >
          ↻ Try again
        </button>
        <a
          href="/"
          className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-slate-500 hover:text-slate-100"
        >
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
