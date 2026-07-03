import { copyFile, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const outDir = ".output/public";
const assetsDir = join(outDir, "assets");
const basePath = process.env.VITE_BASE_PATH || "/";
const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
const assetPath = (path) => `${normalizedBase}${path.replace(/^\/+/, "")}`;

const assetFiles = await readdir(assetsDir);
const entryFile = (
  await Promise.all(
    assetFiles
      .filter((file) => /^index-.*\.js$/.test(file))
      .map(async (file) => ({
        file,
        source: await readFile(join(assetsDir, file), "utf8"),
      }))
  )
).find(({ source }) => source.includes("hydrateRoot(document"));

if (!entryFile) {
  throw new Error("Could not find the TanStack Start client entry in .output/public/assets.");
}

const cssFile = assetFiles.find((file) => /^styles-.*\.css$/.test(file));
if (!cssFile) {
  throw new Error("Could not find the generated stylesheet in .output/public/assets.");
}

const html = `<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>SHY - Songwriter Marketplace</title>
    <meta name="description" content="SHY is a marketplace and creative platform for songwriters, song discovery, rights management, fan support, and music buyer opportunities.">
    <meta name="theme-color" content="#0A0A0F">
    <meta name="application-name" content="SHY Music">
    <meta name="apple-mobile-web-app-title" content="SHY Music">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta property="og:title" content="SHY - Songwriter Marketplace">
    <meta property="og:description" content="SHY is a marketplace and creative platform for songwriters, song discovery, rights management, fan support, and music buyer opportunities.">
    <meta property="og:type" content="website">
    <meta property="og:image" content="${assetPath("/assets/brand/shy-logo.png")}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="SHY - Songwriter Marketplace">
    <meta name="twitter:description" content="SHY is a marketplace and creative platform for songwriters, song discovery, rights management, fan support, and music buyer opportunities.">
    <meta name="twitter:image" content="${assetPath("/assets/brand/shy-logo.png")}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap">
    <link rel="icon" type="image/png" sizes="16x16" href="${assetPath("/assets/brand/icon-16.png")}">
    <link rel="icon" type="image/png" sizes="32x32" href="${assetPath("/assets/brand/icon-32.png")}">
    <link rel="icon" type="image/png" sizes="48x48" href="${assetPath("/assets/brand/icon-48.png")}">
    <link rel="apple-touch-icon" sizes="180x180" href="${assetPath("/assets/brand/icon-180.png")}">
    <link rel="manifest" href="${assetPath("/manifest.webmanifest")}">
    <link rel="stylesheet" href="${assetPath(`/assets/${cssFile}`)}">
    <script type="module" crossorigin src="${assetPath(`/assets/${entryFile.file}`)}"></script>
  </head>
  <body class="bg-background text-foreground">
  </body>
</html>
`;

await writeFile(join(outDir, "index.html"), html);
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
