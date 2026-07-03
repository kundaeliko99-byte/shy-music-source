import { withBasePath } from "@/lib/assets";

const BRAND_MARK = withBasePath("/assets/brand/shy-logo-mark.png");
const BRAND_LOCKUP = withBasePath("/assets/brand/shy-logo-lockup.png");

interface ShyLogoProps {
  size?: number;
  /** Kept for API compatibility with existing call sites. */
  showWordmark?: boolean;
  variant?: "compact" | "lockup";
  className?: string;
}

/**
 * SHY Music official brand mark.
 * `size` controls the rendered height in px.
 */
export function ShyLogo({ size = 28, showWordmark = true, variant = "compact", className = "" }: ShyLogoProps) {
  if (variant === "lockup") {
    return (
      <img
        src={BRAND_LOCKUP}
        alt="SHY Music"
        style={{
          height: size,
          width: "auto",
          filter: "drop-shadow(0 0 18px oklch(0.74 0.16 295 / 0.35))",
        }}
        className={`object-contain select-none ${className}`}
        draggable={false}
      />
    );
  }

  return (
    <span
      aria-label="SHY Music"
      style={{
        minHeight: size,
      }}
      className={`inline-flex items-center gap-2 select-none ${className}`}
    >
      <img
        src={BRAND_MARK}
        alt=""
        style={{
          width: size,
          height: size,
          filter: "drop-shadow(0 0 10px oklch(0.74 0.16 295 / 0.45))",
        }}
        className="shrink-0 rounded-md object-cover"
        draggable={false}
      />
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span className="text-sm font-semibold tracking-normal text-foreground">SHY</span>
          <span className="mt-0.5 text-[9px] font-medium tracking-[0.22em] text-primary-glow">MUSIC</span>
        </span>
      )}
    </span>
  );
}
