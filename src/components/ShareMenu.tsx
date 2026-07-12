import { useEffect, useRef, useState } from "react";
import { Share2, Copy, X, Check, Instagram, Music2 } from "lucide-react";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";

interface Props {
  url: string;
  title: string;
  artist?: string;
}

export function ShareMenu({ url, title, artist }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const caption = artist
    ? `🎵 ${title} — ${artist}\nListen on SHY: ${url}`
    : `🎵 ${title}\nListen on SHY: ${url}`;
  const enc = encodeURIComponent;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function nativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text: caption, url });
        setOpen(false);
        return true;
      } catch { /* user cancelled */ }
    }
    return false;
  }

  async function copyLink() {
    try {
      await copyText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy was blocked. Try sharing manually.");
    }
  }

  async function copyCaption(platform: string) {
    try {
      await copyText(caption);
      toast.success(`Caption copied — open ${platform} and paste`);
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
    <div className="relative" ref={ref}>
      <button
        onClick={async () => {
          // On mobile prefer native share sheet; on desktop open our menu
          const ok = await nativeShare();
          if (!ok) setOpen((v) => !v);
        }}
        className="w-10 h-10 rounded-full hairline flex items-center justify-center text-muted-foreground hover:bg-surface-elevated"
        aria-label="Share"
      >
        <Share2 className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 z-50 bg-surface hairline rounded-xl p-2 shadow-glow">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Share track</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1 p-1">
            <ShareTile label="WhatsApp" color="#25D366" onClick={() => openIntent(`https://wa.me/?text=${enc(caption)}`)}>
              <span className="font-bold text-sm">W</span>
            </ShareTile>
            <ShareTile label="X" color="#000" onClick={() => openIntent(`https://twitter.com/intent/tweet?text=${enc(caption)}`)}>
              <span className="font-bold text-sm">𝕏</span>
            </ShareTile>
            <ShareTile label="Facebook" color="#1877F2" onClick={() => openIntent(`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}&quote=${enc(caption)}`)}>
              <span className="font-bold text-sm">f</span>
            </ShareTile>
            <ShareTile label="Telegram" color="#229ED9" onClick={() => openIntent(`https://t.me/share/url?url=${enc(url)}&text=${enc(caption)}`)}>
              <span className="font-bold text-xs">✈</span>
            </ShareTile>
            <ShareTile label="Reddit" color="#FF4500" onClick={() => openIntent(`https://www.reddit.com/submit?url=${enc(url)}&title=${enc(title)}`)}>
              <span className="font-bold text-xs">R</span>
            </ShareTile>
            <ShareTile label="Instagram" color="#E1306C" onClick={() => copyCaption("Instagram")}>
              <Instagram className="w-4 h-4" />
            </ShareTile>
            <ShareTile label="TikTok" color="#000" onClick={() => copyCaption("TikTok")}>
              <Music2 className="w-4 h-4" />
            </ShareTile>
            <ShareTile label={copied ? "Copied" : "Copy"} color="#7C3AED" onClick={copyLink}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </ShareTile>
          </div>
          <p className="text-[10px] text-muted-foreground px-2 pt-1 pb-1.5 leading-snug">
            Instagram &amp; TikTok don't accept web shares — we copy the caption so you can paste it.
          </p>
        </div>
      )}
    </div>
  );
}

function ShareTile({
  label, color, onClick, children,
}: { label: string; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 py-2 rounded-lg hover:bg-surface-elevated transition-colors"
      title={label}
    >
      <span
        className="w-8 h-8 rounded-full flex items-center justify-center text-white"
        style={{ backgroundColor: color }}
      >
        {children}
      </span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </button>
  );
}
