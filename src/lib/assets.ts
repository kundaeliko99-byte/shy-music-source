import { APP_VERSION } from "./appConfig";

const baseUrl = import.meta.env.BASE_URL || "/";

export function withBasePath(path: string) {
  const cleanBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const cleanPath = path.replace(/^\/+/, "");
  return `${cleanBase}${cleanPath}`;
}

export function withVersionedBasePath(path: string) {
  const url = withBasePath(path);
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(APP_VERSION)}`;
}

export function routerBasePath() {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  return cleanBase || "/";
}
