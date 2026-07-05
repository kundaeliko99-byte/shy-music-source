import { Pause, Play } from "lucide-react";
import type { MouseEvent } from "react";

interface HoverPlayIconProps {
  label: string;
  text?: string;
  active?: boolean;
  playing?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}

const controlClass =
  "hover-play-control inline-flex h-11 items-center gap-2 rounded-full bg-primary px-3 text-primary-foreground shadow-[0_12px_32px_-14px_var(--color-primary),0_0_24px_-10px_var(--color-primary-glow)] opacity-0 translate-y-2 scale-95 transition duration-200 hover:scale-105 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:translate-y-0 group-focus-within:scale-100";

const iconWrapClass = "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full";

export function HoverPlayIcon({ label, text = "Play", active = false, playing = false, onClick }: HoverPlayIconProps) {
  const Icon = active && playing ? Pause : Play;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="absolute bottom-2 right-2 z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-full"
      >
        <span className={controlClass}>
          <span className={iconWrapClass}>
            <Icon className={`h-5 w-5 ${active && playing ? "" : "ml-0.5 fill-current"}`} />
          </span>
          <span className="hidden whitespace-nowrap pr-1 text-xs font-semibold tracking-normal sm:inline">{text}</span>
        </span>
      </button>
    );
  }

  return (
    <span aria-hidden="true" className="absolute bottom-2 right-2 z-10">
      <span className={`pointer-events-none ${controlClass}`}>
        <span className={iconWrapClass}>
          <Icon className={`h-5 w-5 ${active && playing ? "" : "ml-0.5 fill-current"}`} />
        </span>
        <span className="hidden whitespace-nowrap pr-1 text-xs font-semibold tracking-normal sm:inline">{text}</span>
      </span>
    </span>
  );
}
