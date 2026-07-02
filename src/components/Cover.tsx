import { fallbackCover } from "@/lib/format";

export type ArtworkShape = "circle" | "rounded" | "diamond" | "hexagon";

interface CoverProps {
  src?: string | null;
  seed: string;
  size?: number;
  className?: string;
  /** Override the shape. If omitted, uses `shape` prop or default circle. */
  rounded?: string;
  /** Track/album shape preference. Defaults to "circle". */
  shape?: ArtworkShape | null;
  /** Add bloom/glow shadow. */
  glow?: boolean;
  /** Spin slowly (used in player when track is playing). */
  spinning?: boolean;
}

const SHAPE_CLASS: Record<ArtworkShape, string> = {
  circle: "rounded-full",
  rounded: "rounded-2xl",
  diamond: "rounded-md",
  hexagon: "rounded-md",
};

const SHAPE_CLIP: Record<ArtworkShape, string | undefined> = {
  circle: undefined,
  rounded: undefined,
  // 45deg rotated square — content gets counter-rotated
  diamond: undefined,
  hexagon: "polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)",
};

export function Cover({
  src,
  seed,
  size,
  className = "",
  rounded,
  shape,
  glow = false,
  spinning = false,
}: CoverProps) {
  const s: ArtworkShape = shape ?? "circle";
  const shapeCls = rounded ?? SHAPE_CLASS[s];
  const isDiamond = s === "diamond" && !rounded;
  const clipPath = !rounded ? SHAPE_CLIP[s] : undefined;

  const sizeStyle: React.CSSProperties = size ? { width: size, height: size } : {};
  const bgStyle: React.CSSProperties = { background: fallbackCover(seed) };
  const glowStyle: React.CSSProperties = glow
    ? { boxShadow: "0 0 40px -10px var(--color-primary), 0 0 80px -30px var(--color-primary)" }
    : {};

  // Diamond: rotate the wrapper 45deg, counter-rotate the inner image.
  if (isDiamond) {
    return (
      <div
        className={`${shapeCls} ${className} ${spinning ? "shy-spin" : ""}`}
        style={{ ...sizeStyle, ...glowStyle, transform: "rotate(45deg)", overflow: "hidden" }}
      >
        <div style={{ width: "100%", height: "100%", transform: "rotate(-45deg) scale(1.42)" }}>
          {src ? (
            <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={bgStyle}>
              <NoteIcon />
            </div>
          )}
        </div>
      </div>
    );
  }

  const wrapperStyle: React.CSSProperties = {
    ...sizeStyle,
    ...glowStyle,
    ...(clipPath ? { clipPath, WebkitClipPath: clipPath } : {}),
  };

  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        className={`${shapeCls} object-cover ${className} ${spinning ? "shy-spin" : ""}`}
        style={wrapperStyle}
      />
    );
  }
  return (
    <div
      className={`${shapeCls} hairline flex items-center justify-center ${className} ${spinning ? "shy-spin" : ""}`}
      style={{ ...wrapperStyle, ...bgStyle }}
    >
      <NoteIcon />
    </div>
  );
}

function NoteIcon() {
  return (
    <svg width="40%" height="40%" viewBox="0 0 24 24" fill="none" className="opacity-60">
      <path d="M9 18V5l12-2v13" stroke="oklch(0.96 0.012 285)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="6" cy="18" r="3" stroke="oklch(0.96 0.012 285)" strokeWidth="1.5" />
      <circle cx="18" cy="16" r="3" stroke="oklch(0.96 0.012 285)" strokeWidth="1.5" />
    </svg>
  );
}
