import type { ReactNode } from "react";

interface RowProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

export function HorizontalRow({ title, action, children }: RowProps) {
  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base sm:text-lg font-semibold">{title}</h2>
        {action}
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 pb-2">
        {children}
      </div>
    </section>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="hairline rounded-xl bg-surface px-6 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-surface-elevated animate-pulse rounded-md ${className}`} />;
}
