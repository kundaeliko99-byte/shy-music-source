import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAudioStoragePath, resolveAudioUrl } from "@/lib/media";

interface Props {
  trackId: string;
  title: string;
  audioUrl: string;
  artistId: string;
  size?: "sm" | "md";
}

type DownloadState = "idle" | "preparing" | "downloading";

function sanitize(name: string) {
  return name.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "track";
}

function extensionFromContentType(contentType: string | null) {
  if (!contentType) return "";
  if (contentType.includes("mpeg") || contentType.includes("mp3")) return "mp3";
  if (contentType.includes("wav")) return "wav";
  if (contentType.includes("mp4") || contentType.includes("aac")) return "m4a";
  if (contentType.includes("ogg")) return "ogg";
  if (contentType.includes("webm")) return "webm";
  return "";
}

function extensionFromUrl(value: string) {
  const path = getAudioStoragePath(value).split("?")[0];
  const ext = path.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  return ext || "mp3";
}

function downloadSessionId() {
  if (typeof window === "undefined") return null;
  const key = "shy.download.session";
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    window.sessionStorage.setItem(key, id);
  } catch {
    return id;
  }
  return id;
}

function isAvailabilityError(error: { message?: string } | null | undefined) {
  return /not available for public download/i.test(error?.message ?? "");
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export function DownloadButton({ trackId, title, audioUrl, size = "md" }: Props) {
  const [state, setState] = useState<DownloadState>("idle");
  const busy = state !== "idle";
  const isIcon = size === "sm";

  async function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;

    setState("preparing");
    try {
      const { error: claimError } = await withTimeout<{ error: { message?: string } | null }>(
        (supabase as any).rpc("claim_download", {
          p_track_id: trackId,
          p_session_id: downloadSessionId(),
        }),
        5000,
        "Download analytics timed out",
      ).catch((error) => ({ error }));
      if (claimError) {
        if (isAvailabilityError(claimError)) throw claimError;
        console.warn("[download] download analytics claim skipped", claimError);
      }

      const signedUrl = await withTimeout(resolveAudioUrl(audioUrl, 600), 10000, "Could not prepare download link");
      setState("downloading");
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 45000);
      const response = await fetch(signedUrl, { signal: controller.signal });
      window.clearTimeout(timeout);
      if (!response.ok) throw new Error(`Download failed with status ${response.status}`);

      const blob = await response.blob();
      const contentExt = extensionFromContentType(response.headers.get("content-type"));
      const ext = contentExt || extensionFromUrl(audioUrl);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${sanitize(title)}.${ext}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      toast.success("Download started");
    } catch (error) {
      console.warn("[download] free download failed", error);
      toast.error("This song could not be downloaded. Check your connection and try again.");
    } finally {
      setState("idle");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      title="Download this song for free"
      className={
        isIcon
          ? "w-9 h-9 rounded-full hairline flex items-center justify-center text-muted-foreground hover:bg-surface-elevated hover:text-foreground disabled:opacity-50"
          : "inline-flex items-center gap-1.5 rounded-full hairline bg-surface px-4 py-2 text-xs font-medium hover:bg-surface-elevated disabled:opacity-50"
      }
      aria-label={busy ? `Preparing download for ${title}` : `Download ${title} for free`}
      aria-busy={busy}
    >
      <Download className={isIcon ? "w-4 h-4" : "w-3.5 h-3.5"} />
      {!isIcon && (state === "preparing" ? "Preparing..." : state === "downloading" ? "Downloading..." : "Download")}
    </button>
  );
}
