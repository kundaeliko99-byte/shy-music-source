import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { Check, Copy, Instagram, Music2, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";

interface Props {
  url: string;
  title: string;
  artist?: string;
  size?: "sm" | "md";
  className?: string;
  buttonClassName?: string;
  label?: string;
  menuPlacement?: "top" | "bottom";
}

export function ShareMenu({
  url,
  title,
  artist,
  size = "md",
  className = "",
  buttonClassName = "",
  label = "Share",
  menuPlacement = "bottom",
}: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const caption = artist
    ? `${title} - ${artist}\nListen on SHY: ${url}`
    : `${title}\nListen on SHY: ${url}`;
  const enc = encodeURIComponent;
  const buttonSize = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const menuPosition = menuPlacement === "top" ? "bottom-full mb-2" : "mt-2";

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function nativeShare() {
    const prefersNativeShare =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;

    if (prefersNativeShare && typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text: caption, url });
        setOpen(false);
        return true;
      } catch {
        // User cancelled native share.
      }
    }
    return false;
  }

  async function handleButtonClick(event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const ok = await nativeShare();
    if (!ok) setOpen((value) => !value);
  }

  async function copyLink() {
    try {
      await copyText(url);
      setCopied(true);
      toast.success("Song link copied");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy was blocked. Try sharing manually.");
    }
  }

  async function copyCaption(platform: string) {
    try {
      await copyText(caption);
      toast.success(`Caption copied. Open ${platform} and paste it.`);
      setOpen(false);
    } catch {
      toast.error("Copy was blocked. Try sharing manually.");
    }
  }

  function openIntent(href: string) {
    window.open(href, "_blank", "noopener,noreferrer,width=600,height=600");
    setOpen(false);
  }

  return (
    <div
      className={`relative ${className}`}
      ref={ref}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={handleButtonClick}
        className={`${buttonSize} rounded-full hairline flex items-center justify-center text-muted-foreground transition hover:bg-surface-elevated hover:text-foreground active:scale-90 ${buttonClassName}`}
        aria-label={label}
        title={label}
      >
        <Share2 className={iconSize} />
      </button>

      {open && (
        <div className={`absolute right-0 z-50 w-64 rounded-xl bg-surface p-2 shadow-glow hairline ${menuPosition}`}>
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Share song</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close share menu"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1 p-1">
            <ShareTile label="WhatsApp" color="#25D366" onClick={() => openIntent(`https://wa.me/?text=${enc(caption)}`)}>
              <span className="text-sm font-bold">W</span>
            </ShareTile>
            <ShareTile label="X" color="#000" onClick={() => openIntent(`https://twitter.com/intent/tweet?text=${enc(caption)}`)}>
              <span className="text-sm font-bold">X</span>
            </ShareTile>
            <ShareTile label="Facebook" color="#1877F2" onClick={() => openIntent(`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}&quote=${enc(caption)}`)}>
              <span className="text-sm font-bold">f</span>
            </ShareTile>
            <ShareTile label="Telegram" color="#229ED9" onClick={() => openIntent(`https://t.me/share/url?url=${enc(url)}&text=${enc(caption)}`)}>
              <span className="text-xs font-bold">TG</span>
            </ShareTile>
            <ShareTile label="Reddit" color="#FF4500" onClick={() => openIntent(`https://www.reddit.com/submit?url=${enc(url)}&title=${enc(title)}`)}>
              <span className="text-xs font-bold">R</span>
            </ShareTile>
            <ShareTile label="Instagram" color="#E1306C" onClick={() => copyCaption("Instagram")}>
              <Instagram className="h-4 w-4" />
            </ShareTile>
            <ShareTile label="TikTok" color="#000" onClick={() => copyCaption("TikTok")}>
              <Music2 className="h-4 w-4" />
            </ShareTile>
            <ShareTile label={copied ? "Copied" : "Copy"} color="#7C3AED" onClick={copyLink}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </ShareTile>
          </div>
          <p className="px-2 pb-1.5 pt-1 text-[10px] leading-snug text-muted-foreground">
            Instagram and TikTok do not accept web shares, so SHY copies the caption for you.
          </p>
        </div>
      )}
    </div>
  );
}

function ShareTile({
  label,
  color,
  onClick,
  children,
}: {
  label: string;
  color: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-lg py-2 transition-colors hover:bg-surface-elevated"
      title={label}
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: color }}
      >
        {children}
      </span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </button>
  );
}
