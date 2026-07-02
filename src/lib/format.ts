export function fmtTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function fmtCount(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

const COVER_GRADIENTS = [
  "linear-gradient(135deg, oklch(0.35 0.18 295), oklch(0.18 0.05 280))",
  "linear-gradient(135deg, oklch(0.4 0.18 220), oklch(0.18 0.05 240))",
  "linear-gradient(135deg, oklch(0.42 0.16 145), oklch(0.18 0.05 160))",
  "linear-gradient(135deg, oklch(0.45 0.18 30), oklch(0.18 0.05 20))",
  "linear-gradient(135deg, oklch(0.4 0.16 320), oklch(0.18 0.05 285))",
];

export function fallbackCover(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return COVER_GRADIENTS[Math.abs(h) % COVER_GRADIENTS.length];
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
