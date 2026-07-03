import { copyFile, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

const outDir = ".output/public";
const basePath = process.env.VITE_BASE_PATH || "/";
const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;

await rename(join(outDir, "github-pages.html"), join(outDir, "index.html"));
await copyFile(join(outDir, "index.html"), join(outDir, "404.html"));
await writeFile(join(outDir, ".nojekyll"), "");

const manifestPath = join(outDir, "manifest.webmanifest");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

manifest.start_url = normalizedBase;
manifest.scope = normalizedBase;
manifest.icons = manifest.icons?.map((icon) => ({
  ...icon,
  src: `${normalizedBase}${String(icon.src).replace(/^\/+/, "")}`,
}));

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
