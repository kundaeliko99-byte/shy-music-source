import { fallbackCover } from "@/lib/format";
import type { ReactNode } from "react";

interface CDCaseAlbumCoverProps {
  src?: string | null;
  seed: string;
  className?: string;
  children?: ReactNode;
}

export function CDCaseAlbumCover({ src, seed, className = "", children }: CDCaseAlbumCoverProps) {
  const bgStyle = src ? undefined : { background: fallbackCover(seed) };

  return (
    <div className={`group relative aspect-square ${className}`}>
      <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 bg-black/70 blur-sm" />
      <div className="relative h-full w-full overflow-hidden rounded-[3px] border border-zinc-500/45 bg-black shadow-[0_18px_42px_-26px_rgba(0,0,0,0.95),inset_0_0_0_1px_rgba(255,255,255,0.12)]">
        <div className="absolute inset-y-0 left-0 z-[3] w-[7.5%] bg-gradient-to-r from-black via-zinc-950 to-zinc-800 shadow-[inset_-1px_0_0_rgba(255,255,255,0.18)]" />
        <div className="absolute inset-y-0 right-0 z-[3] w-[3.5%] bg-gradient-to-l from-black/80 to-transparent" />

        <div className="absolute inset-[5%] left-[8.5%] overflow-hidden bg-surface">
          {src ? (
            <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center" style={bgStyle}>
              <DiscGlyph />
            </div>
          )}
        </div>

        <div className="absolute inset-0 z-[4] bg-[linear-gradient(115deg,rgba(255,255,255,0.32)_0%,rgba(255,255,255,0.06)_22%,transparent_38%,rgba(255,255,255,0.11)_54%,transparent_72%)] opacity-65" />
        <div className="absolute left-[2.2%] top-[6%] z-[5] h-[14%] w-[4%] rounded-sm border border-zinc-300/30 bg-white/10" />
        <div className="absolute bottom-[6%] left-[2.2%] z-[5] h-[14%] w-[4%] rounded-sm border border-zinc-300/30 bg-white/10" />
        <div className="absolute inset-x-[1.5%] top-[1.5%] z-[5] h-px bg-zinc-200/35" />
        <div className="absolute inset-x-[1.5%] bottom-[1.5%] z-[5] h-px bg-black/80" />
        <div className="absolute inset-0 z-[6] rounded-[3px] border border-white/18 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.55)]" />
        {children}
      </div>
    </div>
  );
}

function DiscGlyph() {
  return (
    <svg width="46%" height="46%" viewBox="0 0 48 48" fill="none" className="text-zinc-300/60">
      <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M24 6v8M42 24h-8M24 42v-8M6 24h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".65" />
    </svg>
  );
}
