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
      <div className="absolute -inset-4 rounded-2xl bg-primary/35 blur-2xl" />
      <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-[4px] bg-black/80 blur-sm" />
      <div className="relative h-full w-full overflow-hidden rounded-[4px] border-[3px] border-zinc-300/45 bg-black shadow-[0_20px_52px_-24px_rgba(0,0,0,1),inset_0_0_0_2px_rgba(255,255,255,0.14)]">
        <div className="absolute inset-y-0 left-0 z-[4] w-[9%] bg-gradient-to-r from-black via-zinc-950 to-zinc-700 shadow-[inset_-2px_0_0_rgba(255,255,255,0.22),2px_0_12px_rgba(0,0,0,0.55)]" />
        <div className="absolute inset-y-0 right-0 z-[4] w-[4.5%] bg-gradient-to-l from-black via-black/65 to-transparent" />
        <div className="absolute inset-[5.5%] left-[10%] overflow-hidden border border-black/60 bg-surface">
          {src ? (
            <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center" style={bgStyle}>
              <DiscGlyph />
            </div>
          )}
        </div>
        <div className="absolute inset-0 z-[5] bg-[linear-gradient(112deg,rgba(255,255,255,0.42)_0%,rgba(255,255,255,0.1)_24%,transparent_38%,rgba(255,255,255,0.14)_57%,transparent_74%)] opacity-75" />
        <div className="absolute left-[2%] top-[5%] z-[6] h-[15%] w-[5%] rounded-sm border border-zinc-100/40 bg-white/12" />
        <div className="absolute bottom-[5%] left-[2%] z-[6] h-[15%] w-[5%] rounded-sm border border-zinc-100/40 bg-white/12" />
        <div className="absolute left-[2.2%] top-[24%] z-[6] h-[52%] w-px bg-zinc-100/25" />
        <div className="absolute inset-x-[1.5%] top-[1.8%] z-[6] h-px bg-white/45" />
        <div className="absolute inset-x-[1.5%] bottom-[1.8%] z-[6] h-px bg-black/90" />
        <div className="absolute inset-0 z-[7] rounded-[4px] border border-white/24 shadow-[inset_0_0_0_2px_rgba(0,0,0,0.52)]" />
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
