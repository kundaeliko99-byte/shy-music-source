type CoverKind = "single" | "album";

interface AtmosphericCoverArtProps {
  seed: string;
  kind?: CoverKind;
  label?: string;
  className?: string;
}

const TITLES = ["SHY", "NEON", "VIOLET", "MIDNIGHT", "ECHO", "GLOW", "AFTER DARK", "INK"];

function hashSeed(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function coverTitle(seed: string, label?: string) {
  const clean = label?.trim().split(/\s+/).slice(0, 3).join(" ");
  if (clean) return clean.toUpperCase();
  return TITLES[hashSeed(seed) % TITLES.length];
}

export function AtmosphericCoverArt({ seed, kind = "single", label, className = "" }: AtmosphericCoverArtProps) {
  const h = hashSeed(seed);
  const title = coverTitle(seed, label);
  const figureType = h % 3;
  const glowX = 38 + (h % 25);
  const glowY = kind === "album" ? 42 : 37;

  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-[#05020a] text-white [container-type:inline-size] ${className}`}
      style={{
        background:
          `radial-gradient(circle at ${glowX}% ${glowY}%, rgba(190, 112, 255, 0.72) 0%, rgba(126, 45, 205, 0.42) 20%, rgba(34, 10, 56, 0.72) 46%, #06020b 82%), linear-gradient(145deg, #2a0b45 0%, #10051f 47%, #030208 100%)`,
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_40%,rgba(255,255,255,0.14),transparent_18%),radial-gradient(circle_at_18%_24%,rgba(132,70,255,0.22),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_38%,rgba(0,0,0,0.6))]" />
      <div className="absolute -inset-x-8 top-[18%] h-[34%] rounded-full bg-primary/18 blur-2xl" />
      <div className="absolute inset-0 opacity-45 [background-image:radial-gradient(circle,rgba(255,255,255,0.58)_0_1px,transparent_1.4px)] [background-size:18px_18px]" />
      <div className="absolute inset-x-0 bottom-0 h-[32%] bg-[linear-gradient(180deg,transparent,rgba(2,1,6,0.82))]" />
      <div className="absolute left-[16%] top-[21%] h-[38%] w-[68%] rounded-full bg-fuchsia-200/12 blur-xl" />

      <Silhouette type={figureType} />

      <div className="absolute inset-x-[10%] top-[8%] z-20">
        <div className="truncate text-center text-[clamp(0.625rem,14cqw,2.875rem)] font-black uppercase leading-none tracking-normal text-[#f1eaff] drop-shadow-[0_3px_12px_rgba(0,0,0,0.8)]">
          {title}
        </div>
      </div>

      <div className="absolute inset-0 ring-1 ring-inset ring-white/12" />
    </div>
  );
}

function Silhouette({ type }: { type: number }) {
  if (type === 1) {
    return (
      <div className="absolute left-[32%] top-[34%] z-10 h-[45%] w-[36%]">
        <div className="absolute inset-x-[22%] top-0 h-[28%] rounded-full bg-[#090411] shadow-[0_0_24px_8px_rgba(199,118,255,0.18)]" />
        <div className="absolute inset-x-[5%] bottom-0 h-[74%] rounded-t-[50%] bg-[linear-gradient(90deg,#06030d,#130721_46%,#030208)] shadow-[inset_-10px_0_18px_rgba(205,142,255,0.22),0_0_30px_rgba(143,64,255,0.28)]" />
      </div>
    );
  }

  if (type === 2) {
    return (
      <div className="absolute left-[29%] top-[30%] z-10 h-[47%] w-[42%]">
        <div className="absolute left-[16%] top-[14%] h-[68%] w-[68%] rotate-45 rounded-[18%] bg-[#07030e] shadow-[inset_-12px_0_22px_rgba(202,126,255,0.28),0_0_34px_rgba(157,75,255,0.34)]" />
        <div className="absolute left-[34%] top-[32%] h-[32%] w-[32%] rotate-45 rounded-[18%] border border-white/18 bg-black/36" />
      </div>
    );
  }

  return (
    <div className="absolute left-[34%] top-[28%] z-10 h-[48%] w-[32%]">
      <div className="absolute inset-x-[24%] top-0 h-[22%] rounded-full bg-[#08030f] shadow-[inset_-7px_0_16px_rgba(221,168,255,0.28),0_0_28px_rgba(154,82,255,0.32)]" />
      <div className="absolute inset-x-[11%] top-[20%] h-[58%] rounded-t-full bg-[#07030d] shadow-[inset_-12px_0_22px_rgba(194,119,255,0.24),0_0_32px_rgba(147,63,255,0.3)]" />
      <div className="absolute inset-x-0 bottom-0 h-[30%] rounded-t-full bg-[#05020a] shadow-[inset_-10px_0_18px_rgba(198,116,255,0.2)]" />
    </div>
  );
}
