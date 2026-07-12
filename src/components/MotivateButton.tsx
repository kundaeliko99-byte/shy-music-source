import { useState } from "react";
import { Check, Copy, Gift, Heart, X } from "lucide-react";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";

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

export function MotivateButton({ artist, size = "md", variant = "solid", onMotivated }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!artist.mobile_money_number || !artist.mobile_money_network) return null;

  const sizeClasses =
    size === "sm"
      ? "text-[11px] px-2.5 py-1 gap-1"
      : "text-xs px-4 py-2 gap-1.5";

  const variantClasses =
    variant === "solid"
      ? "bg-gradient-primary text-primary-foreground shadow-glow-soft"
      : "bg-primary/15 text-primary-glow hairline border-primary/40";

  async function handleCopy(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    try {
      await copyText(artist.mobile_money_number!);
      setCopied(true);
      toast.success("Number copied");
      onMotivated?.();
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy was blocked. Manually copy the number shown.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        className={`inline-flex cursor-pointer items-center rounded-full font-medium ${sizeClasses} ${variantClasses}`}
        aria-label={`Motivate ${artist.display_name}`}
      >
        <Gift className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
        Motivate Artist
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-background/85 p-4"
          onClick={() => setOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`motivate-title-${artist.id}`}
            className="relative w-full max-w-sm rounded-2xl bg-surface p-5 text-center text-foreground shadow-glow hairline"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-surface-elevated text-muted-foreground hairline hover:text-foreground"
              aria-label="Close motivation menu"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary-glow hairline">
              <Heart className="h-5 w-5 fill-current" />
            </div>
            <div className="mt-3 text-[10px] font-medium tracking-[0.25em] text-primary-glow">
              MOTIVATE
            </div>
            <h3 id={`motivate-title-${artist.id}`} className="mt-1 pr-8 text-lg font-semibold">
              {artist.display_name}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Send appreciation directly to the artist by mobile money.
            </p>

            <div className="mt-5 rounded-xl bg-surface-elevated p-4 hairline">
              <div className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground">
                {networkLabel(artist.mobile_money_network).toUpperCase()}
              </div>
              <div className="mt-1 select-all text-xl font-semibold tracking-wider">
                {artist.mobile_money_number}
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-glow-soft"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy Number"}
              </button>
            </div>

            <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
              SHY does not process this payment. It is a direct transfer to the artist.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
