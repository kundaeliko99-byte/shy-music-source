import type { ReactNode } from "react";
import { AtmosphericCoverArt } from "./AtmosphericCoverArt";

interface CDCaseAlbumCoverProps {
  src?: string | null;
  seed: string;
  className?: string;
  children?: ReactNode;
}

export function CDCaseAlbumCover({ src, seed, className = "", children }: CDCaseAlbumCoverProps) {
  return (
    <div className={`group relative aspect-square [perspective:900px] ${className}`}>
      <div className="absolute -inset-5 rounded-2xl bg-primary/35 blur-2xl" />
      <div className="absolute inset-[4%] translate-x-2 translate-y-3 rounded-lg bg-black/85 blur-md" />
      <div className="relative h-full w-full overflow-hidden rounded-lg border border-white/12 bg-[#05020a] shadow-[0_26px_70px_-30px_rgba(0,0,0,1),0_0_42px_-18px_rgba(168,85,247,0.95)] transition-transform duration-300 group-hover:[transform:rotateX(2deg)_rotateY(-3deg)_translateY(-2px)]">
        <div className="absolute inset-0 z-[1] translate-x-[2.5%] translate-y-[2.5%] rounded-lg bg-gradient-to-br from-violet-500/20 via-black/40 to-black/85" />
        <div className="relative z-[2] h-full w-full overflow-hidden rounded-[7px]">
          {src ? (
            <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <AtmosphericCoverArt seed={seed} kind="album" />
          )}
        </div>
        <div className="absolute inset-0 z-[3] rounded-lg bg-[linear-gradient(126deg,rgba(255,255,255,0.24)_0%,rgba(255,255,255,0.08)_18%,transparent_38%,rgba(167,139,250,0.12)_72%,transparent_100%)]" />
        <div className="absolute inset-0 z-[4] rounded-lg ring-1 ring-inset ring-white/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-18px_32px_rgba(0,0,0,0.38)]" />
        {children}
      </div>
    </div>
  );
}
