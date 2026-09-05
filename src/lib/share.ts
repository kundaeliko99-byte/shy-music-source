import { withBasePath } from "@/lib/assets";
import { configuredPublicSiteUrl, OFFICIAL_SITE_URL } from "@/lib/appConfig";

export function appShareUrl(path: string) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const appPath = withBasePath(cleanPath);

  if (typeof window !== "undefined" && window.location?.origin) {
    return new URL(appPath, window.location.origin).toString();
  }

  const configured = safeSiteUrl(configuredPublicSiteUrl());
  const configuredPath = configured.pathname.endsWith("/") ? configured.pathname : `${configured.pathname}/`;
  const relativePath = appPath.startsWith(configuredPath)
    ? appPath.slice(configuredPath.length)
    : appPath.replace(/^\/+/, "");
  return new URL(relativePath, configured).toString();
}

export function trackShareUrl(trackId: string) {
  return appShareUrl(`/tracks/${encodeURIComponent(trackId)}`);
}

function safeSiteUrl(value: string) {
  try {
    const url = new URL(value);
    if (!url.pathname.endsWith("/")) url.pathname = `${url.pathname}/`;
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return new URL(OFFICIAL_SITE_URL);
  }
}
