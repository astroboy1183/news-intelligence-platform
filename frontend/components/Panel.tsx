import { ReactNode } from "react";

export default function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
