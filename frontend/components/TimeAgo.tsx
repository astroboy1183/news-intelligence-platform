"use client";

import { useEffect, useState } from "react";

import { relativeTime } from "@/lib/format";

/**
 * Renders a "Xm ago" relative-time string that updates every 30 seconds on
 * the client. On the server we render a stable placeholder so SSR + hydration
 * agree — the real value swaps in after hydration via useEffect.
 */
export default function TimeAgo({
  iso,
  fallback = "…",
}: {
  iso: string | null | undefined;
  fallback?: string;
}) {
  const [text, setText] = useState<string>(fallback);

  useEffect(() => {
    if (!iso) {
      setText("");
      return;
    }
    const update = () => setText(relativeTime(iso));
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [iso]);

  if (!iso) return null;
  // suppressHydrationWarning silences the initial fallback → real-value swap
  // (the server cannot know "now" the way the client does).
  return <span suppressHydrationWarning>{text}</span>;
}
