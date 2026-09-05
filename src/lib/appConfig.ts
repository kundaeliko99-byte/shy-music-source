export const OFFICIAL_REPOSITORY_URL = "https://github.com/kundaeliko99-byte/shy-music-source";
export const OFFICIAL_SITE_URL = "https://kundaeliko99-byte.github.io/shy-music-source/";
export const LEGACY_LOVABLE_URL = "https://shymusic.lovable.app/";

export const APP_VERSION = import.meta.env.VITE_APP_VERSION || "local";

export function configuredPublicSiteUrl() {
  return import.meta.env.VITE_PUBLIC_SITE_URL || import.meta.env.VITE_APP_URL || OFFICIAL_SITE_URL;
}
