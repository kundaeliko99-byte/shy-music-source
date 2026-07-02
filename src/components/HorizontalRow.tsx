import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface RowProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  controls?: boolean;
}

export function HorizontalRow({ title, action, children, controls = true }: RowProps) {
  const scroller = useRef<HTMLDivElement>(null);

  const scrollByPage = (direction: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(220, el.clientWidth * 0.75), behavior: "smooth" });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollByPage(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollByPage(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      window.scrollBy({ top: -240, behavior: "smooth" });
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      window.scrollBy({ top: 240, behavior: "smooth" });
    }
  };

  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base sm:text-lg font-semibold">{title}</h2>
        {action}
      </div>
      <div className="group/row relative">
        {controls && (
          <>
            <button
              type="button"
              onClick={() => scrollByPage(-1)}
              aria-label={`Scroll ${title} left`}
              className="hidden sm:inline-flex absolute left-1 top-1/2 z-10 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full hairline bg-background/65 text-foreground/70 opacity-35 backdrop-blur-md transition hover:bg-background/90 hover:text-foreground hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollByPage(1)}
              aria-label={`Scroll ${title} right`}
              className="hidden sm:inline-flex absolute right-1 top-1/2 z-10 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full hairline bg-background/65 text-foreground/70 opacity-35 backdrop-blur-md transition hover:bg-background/90 hover:text-foreground hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
        <div
          ref={scroller}
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 scroll-smooth focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {children}
        </div>
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
