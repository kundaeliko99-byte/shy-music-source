# SHY Music Repository Instructions

This repository is the active SHYMusic Creative codebase.

## Hosting Source Of Truth

- Authoritative repository: `https://github.com/kundaeliko99-byte/shy-music-source`
- Production branch: `main`
- Official production web URL: `https://kundaeliko99-byte.github.io/shy-music-source/`
- Legacy Lovable prototype: `https://shymusic.lovable.app/`

Do not present the Lovable URL as the current SHY production site. It is historical context only unless a task explicitly asks to inspect or redirect the old prototype.

## Deployment

Use the existing GitHub Pages workflow:

```text
.github/workflows/deploy-github-pages.yml
```

Do not add a competing host or a `CNAME` file until the user confirms a purchased custom domain.

Before reporting deployment readiness, run the relevant checks:

```bash
npx tsc --noEmit
npm run lint
npm run test:free-downloads
VITE_BASE_PATH=/shy-music-source/ npm run build:github
VITE_BASE_PATH=/shy-music-source/ npm run test:hosting
```

When reporting a live deployment, include the official GitHub Pages URL and the footer build id/commit short SHA that was verified.

## Supabase

Supabase is the backend, not the web host. Preserve existing accounts, uploaded music, storage, and data.

Required production auth values:

- Site URL: `https://kundaeliko99-byte.github.io/shy-music-source/`
- Redirect URLs include `/auth` and `/auth/` for production plus local development ports.

Never expose service-role keys, Supabase access tokens, database passwords, or connection strings in client code, GitHub Pages artifacts, or responses.

## Android

The current Android wrapper points to:

```text
https://kundaeliko99-byte.github.io/shy-music-source/
```

Compatible hosted web changes can reach Android users when they reopen or refresh the app. Native Android changes require rebuilding and distributing a new APK/AAB.

Capacitor documents `server.url` as intended for live reload rather than normal production packaging. Do not weaken security with cleartext, mixed content, or broad navigation rules.
