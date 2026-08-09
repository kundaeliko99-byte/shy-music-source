import { withBasePath } from "@/lib/assets";

const FALLBACK_PUBLIC_ORIGIN = "https://kundaeliko99-byte.github.io";

export function appShareUrl(path: string) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const appPath = withBasePath(cleanPath);

  if (typeof window !== "undefined" && window.location?.origin) {
    return new URL(appPath, window.location.origin).toString();
  }

  const configured = import.meta.env.VITE_PUBLIC_SITE_URL || import.meta.env.VITE_APP_URL || FALLBACK_PUBLIC_ORIGIN;
  const origin = safeOrigin(configured);
  return new URL(appPath, origin).toString();
}

export function trackShareUrl(trackId: string) {
  return appShareUrl(`/tracks/${encodeURIComponent(trackId)}`);
}

function safeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return FALLBACK_PUBLIC_ORIGIN;
  }
}
