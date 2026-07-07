import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface RowProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  controls?: boolean;
}

export function HorizontalRow({ title, action, children, controls = true }: RowProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, x: 0, left: 0 });
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const maxScrollLeft = el.scrollWidth - el.clientWidth;
    setHasOverflow(maxScrollLeft > 4);
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < maxScrollLeft - 4);
  }, []);

  useEffect(() => {
    updateScrollButtons();
    const el = scroller.current;
    if (!el || typeof window === "undefined") return;

    const onResize = () => updateScrollButtons();
    const observer = new ResizeObserver(updateScrollButtons);
    observer.observe(el);
    window.addEventListener("resize", onResize);
    const raf = window.requestAnimationFrame(updateScrollButtons);
    const lateCheck = window.setTimeout(updateScrollButtons, 250);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      window.cancelAnimationFrame(raf);
      window.clearTimeout(lateCheck);
    };
  }, [children, updateScrollButtons]);

  const scrollByPage = (direction: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(220, el.clientWidth * 0.75), behavior: "smooth" });
    window.setTimeout(updateScrollButtons, 240);
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

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const el = scroller.current;
    if (!el || event.pointerType === "touch") return;
    if (event.target instanceof Element && event.target.closest("a, button, input, textarea, select, [role='button']")) return;
    drag.current = { active: true, x: event.clientX, left: el.scrollLeft };
    el.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const el = scroller.current;
    if (!el || !drag.current.active) return;
    el.scrollLeft = drag.current.left - (event.clientX - drag.current.x);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const el = scroller.current;
    drag.current.active = false;
    if (el?.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
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
            {hasOverflow && (
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-16 items-center sm:flex">
                <button
                  type="button"
                  onClick={() => scrollByPage(-1)}
                  disabled={!canScrollLeft}
                  aria-label={`Scroll ${title} left`}
                  className="pointer-events-auto ml-1 inline-flex h-10 w-10 items-center justify-center rounded-full hairline bg-background/75 text-foreground/70 opacity-0 backdrop-blur-md transition hover:bg-background/95 hover:text-foreground group-hover/row:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:text-muted-foreground/35 disabled:opacity-0 group-hover/row:disabled:opacity-45"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              </div>
            )}
            {hasOverflow && (
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-16 items-center justify-end sm:flex">
                <button
                  type="button"
                  onClick={() => scrollByPage(1)}
                  disabled={!canScrollRight}
                  aria-label={`Scroll ${title} right`}
                  className="pointer-events-auto mr-1 inline-flex h-10 w-10 items-center justify-center rounded-full hairline bg-background/75 text-foreground/70 opacity-0 backdrop-blur-md transition hover:bg-background/95 hover:text-foreground group-hover/row:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:text-muted-foreground/35 disabled:opacity-0 group-hover/row:disabled:opacity-45"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </>
        )}
        <div
          ref={scroller}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onScroll={updateScrollButtons}
          className="flex cursor-grab gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 scroll-smooth active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
