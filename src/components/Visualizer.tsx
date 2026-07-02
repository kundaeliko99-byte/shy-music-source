import { useEffect, useRef } from "react";

/**
 * A pure-canvas, time-driven bar visualizer.
 * We don't tap WebAudio (would require re-routing the global audio element &
 * cross-origin headers); instead we render a smooth pseudo-spectrum that
 * pulses on isPlaying for a polished feel without breaking playback.
 */
export function Visualizer({ isPlaying, height = 90 }: { isPlaying: boolean; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const BARS = 48;
    let t = 0;

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const gap = 3;
      const barW = (w - gap * (BARS - 1)) / BARS;
      const amp = isPlaying ? 1 : 0.18;
      for (let i = 0; i < BARS; i++) {
        const phase = i * 0.35;
        const v =
          Math.sin(t * 0.06 + phase) * 0.35 +
          Math.sin(t * 0.11 + phase * 1.7) * 0.3 +
          Math.sin(t * 0.04 + phase * 0.7) * 0.35;
        const norm = (v + 1) / 2; // 0..1
        const bh = Math.max(2, norm * h * amp);
        const x = i * (barW + gap);
        const y = h - bh;
        const grad = ctx.createLinearGradient(0, y, 0, h);
        grad.addColorStop(0, "oklch(0.78 0.18 295)");
        grad.addColorStop(1, "oklch(0.45 0.22 295 / 0.5)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        // rounded rect
        const r = Math.min(barW / 2, 4);
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + barW - r, y);
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
        ctx.lineTo(x + barW, h);
        ctx.lineTo(x, h);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.fill();
      }
      t += isPlaying ? 1 : 0.25;
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  return <canvas ref={canvasRef} style={{ width: "100%", height }} aria-hidden />;
}
