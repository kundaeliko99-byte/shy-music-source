import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const outDir = ".output/public";
const expectedBase = process.env.VITE_BASE_PATH || "/shy-music-source/";
const normalizedBase = expectedBase.endsWith("/") ? expectedBase : `${expectedBase}/`;
const checks = [];

function check(name, condition) {
  checks.push({ name, ok: Boolean(condition) });
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const indexPath = join(outDir, "index.html");
const authPath = join(outDir, "auth", "index.html");
const uploadPath = join(outDir, "upload", "index.html");
const notFoundPath = join(outDir, "404.html");
const manifestPath = join(outDir, "manifest.webmanifest");

const [index, auth, manifestText] = await Promise.all([
  readFile(indexPath, "utf8"),
  readFile(authPath, "utf8"),
  readFile(manifestPath, "utf8"),
]);
const manifest = JSON.parse(manifestText);

check("GitHub Pages index.html exists", await exists(indexPath));
check("GitHub Pages 404 fallback exists", await exists(notFoundPath));
check("Direct /upload compatibility page exists", await exists(uploadPath));
check("Direct /auth compatibility page exists", await exists(authPath));
check("Assets use the configured GitHub Pages base path", index.includes(`${normalizedBase}assets/`));
check("Manifest start_url uses the GitHub Pages base path", manifest.start_url === normalizedBase);
check("Manifest scope uses the GitHub Pages base path", manifest.scope === normalizedBase);
check("Manifest icons use the GitHub Pages base path", manifest.icons.every((icon) => String(icon.src).startsWith(normalizedBase)));
check("Static auth page does not offer disabled OAuth providers", !/Continue with Google|Continue with Facebook|Continue with Apple|signInWithOAuth/.test(auth));
check("Static auth page keeps email and phone entry points", /Email/.test(auth) && /Phone number/.test(auth));
check("Static shells do not contain root legal anchors", !/href=["']\/(legal|privacy|cookies|about-ads|safety-privacy|accessibility)\b/.test(`${index}\n${auth}`));

const failed = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? "PASS" : "FAIL"} ${item.name}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
