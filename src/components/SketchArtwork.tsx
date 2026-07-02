import { fallbackCover } from "@/lib/format";
import type { ReactNode } from "react";

type SketchVariant = "album" | "song";

interface SketchArtworkProps {
  src?: string | null;
  seed: string;
  variant: SketchVariant;
  className?: string;
  children?: ReactNode;
}

const ALBUM_CLIP = "polygon(8% 4%, 92% 7%, 96% 48%, 90% 94%, 10% 90%, 4% 45%)";
const SONG_CLIP = "polygon(4% 3%, 97% 4%, 96% 96%, 3% 97%, 2% 8%)";

export function SketchArtwork({ src, seed, variant, className = "", children }: SketchArtworkProps) {
  const isAlbum = variant === "album";
  const clipPath = isAlbum ? ALBUM_CLIP : SONG_CLIP;
  const bgStyle = src ? undefined : { background: fallbackCover(seed) };

  return (
    <div className={`group relative ${className}`}>
      <div
        className="relative h-full w-full overflow-hidden bg-surface"
        style={{ clipPath, WebkitClipPath: clipPath }}
      >
        {src ? (
          <img src={src} alt="" loading="lazy" className="h-full w-full object-cover opacity-90 saturate-[0.88]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={bgStyle}>
            <SketchNoteIcon />
          </div>
        )}
        <div className="absolute inset-0 bg-background/10" />
      </div>
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible text-zinc-300/70"
        viewBox="0 0 100 100"
        fill="none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {isAlbum ? (
          <>
            <path
              d="M8 4 C28 1 62 6 92 7 C96 21 98 35 96 48 C97 64 94 80 90 94 C65 91 34 94 10 90 C5 77 4 60 4 45 C3 30 5 16 8 4Z"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M10 8 C33 5 58 9 90 10 M7 47 C9 64 8 75 12 88 M13 92 C36 88 61 93 87 90"
              stroke="currentColor"
              strokeWidth="0.55"
              strokeLinecap="round"
              opacity="0.55"
            />
          </>
        ) : (
          <>
            <path
              d="M4 3 C26 5 68 2 97 4 C95 27 98 69 96 96 C73 94 27 99 3 97 C5 70 1 27 4 3Z"
              stroke="currentColor"
              strokeWidth="1.15"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M7 7 C35 4 65 6 94 8 M6 94 C34 96 66 93 93 94"
              stroke="currentColor"
              strokeWidth="0.5"
              strokeLinecap="round"
              opacity="0.55"
            />
          </>
        )}
      </svg>
      {children}
    </div>
  );
}

function SketchNoteIcon() {
  return (
    <svg width="42%" height="42%" viewBox="0 0 24 24" fill="none" className="opacity-55">
      <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}
