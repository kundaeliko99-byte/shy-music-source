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
      <div className="absolute inset-[5%] translate-x-3 translate-y-4 rounded-md bg-black/90 blur-md" />
      <div className="relative h-full w-full overflow-hidden rounded-[7px] border border-white/20 bg-[#05020a] shadow-[0_28px_80px_-34px_rgba(0,0,0,1),0_0_46px_-20px_rgba(168,85,247,0.95)] transition-transform duration-300 group-hover:[transform:rotateX(2deg)_rotateY(-3deg)_translateY(-2px)]">
        <div className="absolute inset-0 z-[1] translate-x-[3.5%] translate-y-[3.5%] rounded-md bg-gradient-to-br from-violet-500/20 via-black/45 to-black/90" />
        <div className="absolute bottom-[4%] right-[4%] top-[4%] z-[2] w-[8%] rounded-r-[5px] bg-gradient-to-r from-black/30 via-black/70 to-black/95 shadow-[inset_1px_0_0_rgba(255,255,255,0.14)]" />
        <div className="absolute bottom-[5%] left-[2.5%] top-[5%] z-[4] w-[5.5%] rounded-l-[4px] border-r border-white/18 bg-gradient-to-r from-white/18 via-white/6 to-transparent shadow-[inset_-1px_0_0_rgba(0,0,0,0.65)]" />
        <div className="absolute left-[3.6%] top-[13%] z-[5] h-[15%] w-[2.8%] rounded-sm bg-white/18 shadow-[0_42px_0_rgba(255,255,255,0.15)]" />
        <div className="relative z-[3] h-full w-full overflow-hidden rounded-[6px] p-[4.5%]">
          <div className="h-full w-full overflow-hidden rounded-[3px] border border-black/55 shadow-[0_0_0_1px_rgba(255,255,255,0.08),inset_0_0_26px_rgba(0,0,0,0.35)]">
          {src ? (
            <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <AtmosphericCoverArt seed={seed} kind="album" />
          )}
          </div>
        </div>
        <div className="absolute inset-0 z-[6] rounded-[7px] bg-[linear-gradient(126deg,rgba(255,255,255,0.32)_0%,rgba(255,255,255,0.12)_13%,transparent_35%,rgba(167,139,250,0.12)_72%,transparent_100%)]" />
        <div className="absolute inset-0 z-[7] rounded-[7px] ring-1 ring-inset ring-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.34),inset_0_-20px_34px_rgba(0,0,0,0.42),inset_10px_0_18px_rgba(255,255,255,0.08),inset_-14px_0_22px_rgba(0,0,0,0.58)]" />
        {children}
      </div>
    </div>
  );
}
