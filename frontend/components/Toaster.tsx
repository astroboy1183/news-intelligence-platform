"use client";

import { useEffect, useState } from "react";

import { TOAST_EVENT, type ToastEventDetail, type ToastTone } from "@/lib/toast";

type ToastItem = ToastEventDetail & { id: number };

const TONE_STYLE: Record<ToastTone, string> = {
  error:   "border-rose-500/40 bg-rose-500/15 text-rose-100",
  success: "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
  info:    "border-cyan-500/40 bg-cyan-500/15 text-cyan-100",
};
const TONE_GLYPH: Record<ToastTone, string> = {
  error: "✕",
  success: "✓",
  info: "ⓘ",
};

export default function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    let counter = 0;
    const onToast = (ev: Event) => {
      const detail = (ev as CustomEvent<ToastEventDetail>).detail;
      const id = ++counter;
      const item: ToastItem = { id, ...detail };
      setItems((prev) => [...prev, item]);
      const ttl = detail.ttlMs ?? (detail.tone === "error" ? 7_000 : 4_000);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, ttl);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-16 right-3 z-40 flex w-[min(360px,calc(100vw-1.5rem))] flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {items.map((t) => {
        const tone: ToastTone = t.tone ?? "info";
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${TONE_STYLE[tone]}`}
          >
            <span aria-hidden className="mt-0.5 shrink-0 text-base">
              {TONE_GLYPH[tone]}
            </span>
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
              className="shrink-0 text-xs opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
