const baseUrl = import.meta.env.BASE_URL || "/";

export function withBasePath(path: string) {
  const cleanBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const cleanPath = path.replace(/^\/+/, "");
  return `${cleanBase}${cleanPath}`;
}

export function routerBasePath() {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  return cleanBase || "/";
}
