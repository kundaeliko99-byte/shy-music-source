import { Play } from "lucide-react";
import type { MouseEvent } from "react";

interface HoverPlayIconProps {
  label: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}

const iconClass =
  "pointer-events-none inline-flex h-10 w-10 items-center justify-center text-[#7C3AED] opacity-45 scale-95 transition duration-200 sm:opacity-0 sm:scale-90 sm:group-hover:opacity-100 sm:group-hover:scale-100 sm:group-focus-within:opacity-100 sm:group-focus-within:scale-100";

export function HoverPlayIcon({ label, onClick }: HoverPlayIconProps) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="absolute inset-0 z-10 flex items-center justify-center focus:outline-none"
      >
        <span className={iconClass.replace("pointer-events-none", "")}>
          <Play className="h-8 w-8 fill-current drop-shadow-[0_0_12px_rgba(124,58,237,0.55)]" />
        </span>
      </button>
    );
  }

  return (
    <span aria-hidden="true" className="absolute inset-0 z-10 flex items-center justify-center">
      <span className={iconClass}>
        <Play className="h-8 w-8 fill-current drop-shadow-[0_0_12px_rgba(124,58,237,0.55)]" />
      </span>
    </span>
  );
}
