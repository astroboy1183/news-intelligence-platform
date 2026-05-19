// Tiny toast pub/sub. Fire-and-forget from anywhere on the client; <Toaster/>
// in the root layout listens and renders. No Context/Provider needed — using
// the window event bus keeps callers decoupled from React tree shape and
// avoids re-renders on every toast.

export type ToastTone = "error" | "success" | "info";

export type ToastEventDetail = {
  message: string;
  tone?: ToastTone;
  ttlMs?: number;
};

export const TOAST_EVENT = "nip:toast";

export function toast(message: string, opts: Omit<ToastEventDetail, "message"> = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ToastEventDetail>(TOAST_EVENT, { detail: { message, ...opts } }),
  );
}
