# SHY Hosting And Deployment

SHYMusic Creative is a React/TanStack app built with Vite-style tooling, Tailwind, Supabase, and a Capacitor Android wrapper.

## Source Of Truth

- Authoritative repository: `https://github.com/kundaeliko99-byte/shy-music-source`
- Production branch: `main`
- Official production web URL: `https://kundaeliko99-byte.github.io/shy-music-source/`
- Legacy prototype URL: `https://shymusic.lovable.app/`

Do not report the Lovable URL as the current SHY production app. It is only the old prototype host unless it is later changed to a "SHY has moved" notice.

## Required Environment

Use only browser-safe Supabase values in client and GitHub Pages builds:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_BASE_PATH=/shy-music-source/`
- `VITE_PUBLIC_SITE_URL=https://kundaeliko99-byte.github.io/shy-music-source/`
- `VITE_APP_VERSION=<git commit sha>`

Never commit or expose:

- `SUPABASE_SERVICE_ROLE_KEY`
- Supabase access tokens
- Database passwords or direct connection strings

## GitHub Pages Deployment

The GitHub Pages workflow is:

```text
.github/workflows/deploy-github-pages.yml
```

It deploys automatically when `main` is pushed. The workflow uses the lockfile with `npm ci`, runs typecheck, lint, free-download regression checks, builds the GitHub Pages artifact, verifies the artifact, then publishes `.output/public`.

Required GitHub repository secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Local preflight:

```bash
npm ci
npx tsc --noEmit
npm run lint
npm run test:free-downloads
VITE_BASE_PATH=/shy-music-source/ npm run build:github
VITE_BASE_PATH=/shy-music-source/ npm run test:hosting
```

## GitHub Pages Routing

GitHub Pages does not provide server-side SPA rewrites. The build script creates:

- `index.html`
- `404.html`
- direct compatibility pages for important routes, including `/auth/`, `/upload/`, `/dashboard/`, `/admin/`, `/library/`, and `/become-artist/`

The `404.html` fallback lets bookmarked app routes recover through the client router. The generated manifest is rewritten to use `/shy-music-source/` for `start_url`, `scope`, and icon paths.

## Supabase Auth Redirect Allowlist

In Supabase Dashboard, configure the SHY project auth URL settings as follows.

Site URL:

```text
https://kundaeliko99-byte.github.io/shy-music-source/
```

Redirect URLs:

```text
https://kundaeliko99-byte.github.io/shy-music-source/auth
https://kundaeliko99-byte.github.io/shy-music-source/auth/
http://localhost:8080/auth
http://localhost:8080/auth/
http://localhost:5173/auth
http://localhost:5173/auth/
```

Only enable OAuth providers such as Google, Facebook, or Apple after they are configured in Supabase. Until then, SHY uses email and phone authentication only.

## Free Public Downloads

Downloads are free for visitors and signed-in users after this database migration is applied:

```text
supabase/migrations/20260905090000_free_public_downloads.sql
```

It:

- removes monthly download quota enforcement from the trusted `claim_download` RPC
- allows anonymous claims for tracks whose exact scheduled release time has arrived
- keeps scheduled/private releases blocked
- keeps the audio bucket private and uses signed URLs
- logs anonymous downloads with a browser session id
- preserves existing subscription and billing records

Apply it with Supabase SQL Editor or with a logged-in Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref quwoicqiuorzfxzgewtg
npx supabase db push --project-ref quwoicqiuorzfxzgewtg
```

## Android Update Model

Current Android configuration:

```text
capacitor.config.ts
android/app/src/main/assets/capacitor.config.json
```

Both point to:

```text
https://kundaeliko99-byte.github.io/shy-music-source/
```

This means compatible hosted web changes can reach Android users when they reopen or refresh the app, because the app WebView loads the official GitHub Pages site. It is not the standard production Capacitor model; Capacitor documents `server.url` as intended for live reload, not normal production packaging.

Keep the limitation clear:

- web UI/content/business-logic changes can update through the hosted site
- native app name, icon, splash screen, permissions, Capacitor plugins, `server.url`, and Android manifest changes require a new APK/AAB
- offline support and background audio should be tested on a real device before release
- do not enable cleartext, mixed content, or broad navigation rules to make remote loading work

After changing Capacitor/native config:

```powershell
$env:CAPACITOR_SERVER_URL="https://kundaeliko99-byte.github.io/shy-music-source/"
npm run android:sync
npm run android:build
```

## Deployment Verification

After each deployment, verify:

1. Open `https://kundaeliko99-byte.github.io/shy-music-source/`.
2. Confirm the footer build id matches the deployed commit short SHA.
3. Open `/upload/` directly and refresh.
4. Open `/auth/` directly and confirm only Email/Phone sign-in is offered unless OAuth is configured.
5. Open a shared track link and confirm it uses the GitHub Pages URL.
6. Test playback and one public download.
7. If Android was changed, install the new APK/AAB on a device and verify the app loads the same official URL.
