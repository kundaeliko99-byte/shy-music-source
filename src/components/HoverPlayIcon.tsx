import { Play } from "lucide-react";
import type { MouseEvent } from "react";

interface HoverPlayIconProps {
  label: string;
  text?: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}

const iconClass =
  "inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-2 text-[#7C3AED] shadow-[0_0_18px_rgba(124,58,237,0.35)] backdrop-blur-sm opacity-45 scale-95 transition duration-200 sm:opacity-0 sm:scale-90 sm:group-hover:opacity-100 sm:group-hover:scale-100 sm:group-focus-within:opacity-100 sm:group-focus-within:scale-100";

export function HoverPlayIcon({ label, text = "Play", onClick }: HoverPlayIconProps) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="absolute inset-0 z-10 flex items-center justify-center focus:outline-none"
      >
        <span className={iconClass.replace("pointer-events-none", "")}>
          <Play className="h-5 w-5 fill-current drop-shadow-[0_0_12px_rgba(124,58,237,0.55)]" />
          <span className="text-xs font-semibold text-violet-100">{text}</span>
        </span>
      </button>
    );
  }

  return (
    <span aria-hidden="true" className="absolute inset-0 z-10 flex items-center justify-center">
      <span className={`pointer-events-none ${iconClass}`}>
        <Play className="h-5 w-5 fill-current drop-shadow-[0_0_12px_rgba(124,58,237,0.55)]" />
        <span className="text-xs font-semibold text-violet-100">{text}</span>
      </span>
    </span>
  );
}
