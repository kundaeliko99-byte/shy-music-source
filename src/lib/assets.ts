const baseUrl = import.meta.env.BASE_URL || "/";
const appVersion = import.meta.env.VITE_APP_VERSION || "local";

export function withBasePath(path: string) {
  const cleanBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const cleanPath = path.replace(/^\/+/, "");
  return `${cleanBase}${cleanPath}`;
}

export function withVersionedBasePath(path: string) {
  const url = withBasePath(path);
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(appVersion)}`;
}

export function routerBasePath() {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  return cleanBase || "/";
}
