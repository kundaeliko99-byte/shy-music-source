import { useRef, useState } from "react";
import { Gift, Copy, X, Check, Heart } from "lucide-react";
import { toast } from "sonner";
import { Cover } from "./Cover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { withTimeout } from "@/lib/request";

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
  const [copyState, setCopyState] = useState<"idle" | "copied" | "selected">("idle");
  const [loggedMotivation, setLoggedMotivation] = useState(false);
  const numberRef = useRef<HTMLDivElement | null>(null);

  if (!artist.mobile_money_number || !artist.mobile_money_network) return null;

  function handleOpen(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
    if (!loggedMotivation) {
      setLoggedMotivation(true);
      void logMotivation();
    }
  }

  async function logMotivation() {
    try {
      const { error } = await withTimeout(
        supabase.from("motivations").insert({ artist_id: artist.id, fan_id: user?.id ?? null }),
        "Motivation log",
        5000,
      );
      if (error) throw error;
      onMotivated?.();
    } catch (error) {
      console.warn("Motivation could not be logged", error);
      setLoggedMotivation(false);
    }
  }

  async function copyNumber() {
    const number = artist.mobile_money_number!;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(number);
      } else {
        fallbackCopy(number);
      }
      setCopyState("copied");
      toast.success("Number copied");
      setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      if (fallbackCopy(number)) {
        setCopyState("copied");
        toast.success("Number copied");
        setTimeout(() => setCopyState("idle"), 1800);
        return;
      }
      selectVisibleNumber(numberRef.current);
      setCopyState("selected");
      toast.info("Number selected - copy it from the highlighted text.");
      setTimeout(() => setCopyState("idle"), 2200);
      return;
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

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`inline-flex items-center rounded-full font-medium ${sizeClasses} ${variantClasses}`}
        aria-label={`Motivate ${artist.display_name}`}
      >
        <Gift className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
        Motivate Artist
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-sm bg-surface hairline rounded-2xl p-6 shadow-glow"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-surface-elevated hairline flex items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center">
              <Cover src={artist.avatar_url} seed={artist.id} size={72} shape="circle" glow />
              <div className="text-[10px] tracking-[0.25em] text-primary-glow font-medium mt-3 inline-flex items-center gap-1">
                <Heart className="w-3 h-3 fill-current" /> MOTIVATE
              </div>
              <h3 className="text-lg font-semibold mt-1">{artist.display_name}</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
                Send your appreciation directly to {artist.display_name} via mobile money.
              </p>
            </div>

            <div className="bg-surface-elevated hairline rounded-xl p-4 mt-5 text-center">
              <div className="text-[10px] tracking-[0.2em] text-muted-foreground font-medium">
                {networkLabel(artist.mobile_money_network).toUpperCase()}
              </div>
              <div ref={numberRef} className="text-xl font-semibold tracking-wider mt-1 select-all">
                {artist.mobile_money_number}
              </div>
              <button
                type="button"
                onClick={copyNumber}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-gradient-primary text-primary-foreground shadow-glow-soft"
              >
                {copyState === "copied" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copyState === "copied" ? "Copied" : copyState === "selected" ? "Selected" : "Copy Number"}
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground text-center mt-4 leading-relaxed">
              Open your mobile money app, send any amount to this number, and let your motivation speak.
            </p>
            <p className="text-[10px] text-muted-foreground/70 text-center mt-2">
              SHY does not process this payment — it's a direct transfer to the artist.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function fallbackCopy(value: string) {
  if (typeof document === "undefined") return false;
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "true");
  input.style.position = "fixed";
  input.style.left = "-9999px";
  input.style.top = "0";
  document.body.appendChild(input);
  input.focus();
  input.select();
  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(input);
  }
}

function selectVisibleNumber(element: HTMLElement | null) {
  if (!element || typeof window === "undefined") return;
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  selection?.removeAllRanges();
  selection?.addRange(range);
}
