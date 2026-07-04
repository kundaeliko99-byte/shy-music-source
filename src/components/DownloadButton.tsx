import { useState } from "react";
import { Crown, Download, X } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDownloadQuota } from "@/hooks/useDownloadQuota";
import { useMotivateArtist } from "@/hooks/useMotivate";
import { resolveAudioUrl } from "@/lib/media";
import { MotivateButton } from "./MotivateButton";

interface Props {
  trackId: string;
  title: string;
  audioUrl: string;
  artistId: string;
  size?: "sm" | "md";
}

function sanitize(name: string) {
  return name.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "track";
}

export function DownloadButton({ trackId, title, audioUrl, artistId, size = "md" }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { remaining, allowance, used, isPremium, refresh } = useDownloadQuota();
  const motivateArtist = useMotivateArtist(artistId);
  const [busy, setBusy] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);

  async function doDownload() {
    setBusy(true);
    try {
      const { error: claimError } = await (supabase as any).rpc("claim_download", {
        p_track_id: trackId,
      });
      if (claimError) {
        setShowUpsell(true);
        return;
      }

      const signedUrl = await resolveAudioUrl(audioUrl, 300);
      const res = await fetch(signedUrl);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sanitize(title)}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      await refresh();
      toast.success(
        isPremium
          ? "Downloaded - premium unlimited"
          : `Downloaded - ${Math.max(0, remaining - 1)} downloads left this month`,
      );
    } catch {
      toast.error("Download failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { navigate({ to: "/auth" }); return; }
    if (!isPremium && remaining <= 0) { setShowUpsell(true); return; }
    await doDownload();
  }

  const isIcon = size === "sm";

  return (
    <>
      <button
        onClick={handleClick}
        disabled={busy}
        title={user ? (isPremium ? "Premium unlimited downloads" : `${used}/${allowance} downloads used this month`) : "Sign in to download"}
        className={
          isIcon
            ? "w-9 h-9 rounded-full hairline flex items-center justify-center text-muted-foreground hover:bg-surface-elevated hover:text-foreground disabled:opacity-50"
            : "inline-flex items-center gap-1.5 rounded-full hairline bg-surface px-4 py-2 text-xs font-medium hover:bg-surface-elevated disabled:opacity-50"
        }
        aria-label="Download MP3"
      >
        <Download className={isIcon ? "w-4 h-4" : "w-3.5 h-3.5"} />
        {!isIcon && (busy ? "Downloading…" : "Download")}
      </button>

      {showUpsell && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          onClick={() => setShowUpsell(false)}
        >
          <div
            className="relative w-full max-w-sm bg-surface hairline rounded-2xl p-6 shadow-glow text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowUpsell(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-surface-elevated hairline flex items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-14 h-14 rounded-full bg-gradient-primary text-primary-foreground inline-flex items-center justify-center shadow-glow-soft">
              <Crown className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold mt-3">You've used your 10 free monthly downloads</h3>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Premium listeners get unlimited downloads. You can still motivate an artist
              directly with mobile money to support the creators you love.
            </p>

            <div className="mt-5 flex flex-col items-center gap-3">
              {motivateArtist ? (
                <MotivateButton
                  artist={motivateArtist}
                  onMotivated={() => {
                    refresh();
                    toast.success("Motivation recorded. Thank you for supporting the artist.");
                  }}
                />
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  This artist hasn't set up motivation yet. Find another artist to motivate.
                </p>
              )}
              <button
                onClick={() => setShowUpsell(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
