import { useState } from "react";
import { Check, Copy, Gift, Heart } from "lucide-react";
import { toast } from "sonner";
import { Cover } from "./Cover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { withTimeout } from "@/lib/request";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [loggedMotivation, setLoggedMotivation] = useState(false);

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
      } else if (!fallbackCopy(number)) {
        throw new Error("Clipboard blocked");
      }
      setCopyState("copied");
      toast.success("Number copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      if (fallbackCopy(number)) {
        setCopyState("copied");
        toast.success("Number copied");
        window.setTimeout(() => setCopyState("idle"), 1800);
        return;
      }
      setCopyState("blocked");
      toast.error("Copy was blocked. Long-press or manually select the number.");
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={handleOpen}
        className={`inline-flex cursor-pointer items-center rounded-full font-medium ${sizeClasses} ${variantClasses}`}
        aria-label={`Motivate ${artist.display_name}`}
      >
        <Gift className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
        Motivate Artist
      </button>

      <DialogContent className="max-w-sm bg-surface p-0 hairline">
        <div className="p-6">
          <DialogHeader className="sr-only">
            <DialogTitle>Motivate {artist.display_name}</DialogTitle>
            <DialogDescription>
              Send mobile money support directly to this artist.
            </DialogDescription>
          </DialogHeader>

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
            <div className="text-xl font-semibold tracking-wider mt-1 select-all">
              {artist.mobile_money_number}
            </div>
            <button
              type="button"
              onClick={copyNumber}
              className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-gradient-primary text-primary-foreground shadow-glow-soft"
            >
              {copyState === "copied" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copyState === "copied" ? "Copied" : copyState === "blocked" ? "Copy blocked" : "Copy Number"}
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground text-center mt-4 leading-relaxed">
            Open your mobile money app, send any amount to this number, and let your motivation speak.
          </p>
          <p className="text-[10px] text-muted-foreground/70 text-center mt-2">
            SHY does not process this payment. It is a direct transfer to the artist.
          </p>
        </div>
      </DialogContent>
    </Dialog>
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
