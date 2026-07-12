import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Gift, Heart, X } from "lucide-react";
import { toast } from "sonner";
import { Cover } from "./Cover";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface MotivateArtist {
  id: string;
  display_name: string;
  slug: string;
  avatar_url: string | null;
  mobile_money_number: string | null;
  mobile_money_network: string | null;
}

const NETWORK_LABEL: Record<string, string> = {
  mtn: "MTN Money",
  airtel: "Airtel Money",
  zamtel: "Zamtel Kwacha",
};

export function networkLabel(n: string | null | undefined) {
  return n ? NETWORK_LABEL[n] ?? n : "";
}

interface Props {
  artist: MotivateArtist;
  size?: "sm" | "md";
  variant?: "solid" | "ghost";
  onMotivated?: () => void;
}

/** Renders nothing if the artist hasn't published a motivation number. */
export function MotivateButton({ artist, size = "md", variant = "solid", onMotivated }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "blocked">("idle");
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || typeof window === "undefined") return;

    function positionPanel() {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const gutter = 12;
      const width = Math.min(320, window.innerWidth - gutter * 2);
      const estimatedHeight = 390;
      const left = Math.max(gutter, Math.min(rect.left, window.innerWidth - width - gutter));
      const belowTop = rect.bottom + 8;
      const top =
        belowTop + estimatedHeight > window.innerHeight
          ? Math.max(gutter, rect.top - estimatedHeight - 8)
          : belowTop;

      setPanelStyle({
        position: "fixed",
        left,
        top,
        width,
        maxHeight: `calc(100vh - ${gutter * 2}px)`,
      });
    }

    positionPanel();
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);
    return () => {
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
    };
  }, [open]);

  if (!artist.mobile_money_number || !artist.mobile_money_network) return null;

  function handleOpen(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  }

  async function copyNumber() {
    const number = artist.mobile_money_number!;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard blocked");
      }
      await navigator.clipboard.writeText(number);
      setCopyState("copied");
      toast.success("Number copied");
      void supabase
        .from("motivations")
        .insert({ artist_id: artist.id, fan_id: user?.id ?? null })
        .then(({ error }) => {
          if (error) console.warn("[motivate] failed to record motivation", error);
        });
      onMotivated?.();
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("blocked");
      toast.error("Copy was blocked. Manually copy the number shown.");
      window.setTimeout(() => setCopyState("idle"), 2200);
    }
  }

  const sizeClasses =
    size === "sm"
      ? "text-[11px] px-2.5 py-1 gap-1"
      : "text-xs px-4 py-2 gap-1.5";

  const variantClasses =
    variant === "solid"
      ? "bg-gradient-primary text-primary-foreground shadow-glow-soft"
      : "bg-primary/15 text-primary-glow hairline border-primary/40";

  const detailsPanel =
    open && panelStyle && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            className="relative z-[120] overflow-y-auto rounded-2xl bg-surface p-5 text-foreground shadow-glow hairline"
            style={panelStyle}
            role="dialog"
            aria-modal="false"
            aria-labelledby={`motivate-title-${artist.id}`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-surface-elevated text-muted-foreground transition-colors hairline hover:text-foreground"
              aria-label="Close motivation menu"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col items-center text-center">
              <Cover src={artist.avatar_url} seed={artist.id} size={72} shape="circle" glow />
              <div className="mt-3 inline-flex items-center gap-1 text-[10px] font-medium tracking-[0.25em] text-primary-glow">
                <Heart className="h-3 w-3 fill-current" /> MOTIVATE
              </div>
              <h3 id={`motivate-title-${artist.id}`} className="mt-1 text-lg font-semibold">{artist.display_name}</h3>
              <p className="mt-1 max-w-[260px] text-xs text-muted-foreground">
                Send your appreciation directly to {artist.display_name} via mobile money.
              </p>
            </div>

            <div className="mt-5 rounded-xl bg-surface-elevated p-4 text-center hairline">
              <div className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground">
                {networkLabel(artist.mobile_money_network).toUpperCase()}
              </div>
              <div className="mt-1 select-all text-xl font-semibold tracking-wider">
                {artist.mobile_money_number}
              </div>
              <button
                type="button"
                onClick={copyNumber}
                className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-gradient-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-glow-soft"
              >
                {copyState === "copied" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copyState === "copied" ? "Copied" : copyState === "blocked" ? "Copy blocked" : "Copy Number"}
              </button>
            </div>

            <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
              Open your mobile money app, send any amount to this number, and let your motivation speak.
            </p>
            <p className="mt-2 text-center text-[10px] text-muted-foreground/70">
              SHY does not process this payment. It is a direct transfer to the artist.
            </p>
          </div>,
          document.body,
        )
      : null;

  return (
    <span className="relative inline-flex flex-col items-start">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className={`inline-flex cursor-pointer items-center rounded-full font-medium ${sizeClasses} ${variantClasses}`}
        aria-label={`Motivate ${artist.display_name}`}
      >
        <Gift className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
        Motivate Artist
      </button>
      {detailsPanel}
    </span>
  );
}
