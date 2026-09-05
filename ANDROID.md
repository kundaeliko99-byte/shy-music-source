# SHY Android App

SHY uses Capacitor for Android.

## Official Web Host

The official SHY web app is:

```text
https://kundaeliko99-byte.github.io/shy-music-source/
```

The old Lovable site is only the legacy prototype:

```text
https://shymusic.lovable.app/
```

Do not build or test the Android app against the Lovable URL unless you are intentionally inspecting the old prototype.

## Current Android Model

The Android app currently loads the official GitHub Pages URL through Capacitor `server.url`:

```text
capacitor.config.ts
android/app/src/main/assets/capacitor.config.json
```

That allows compatible hosted web changes to reach installed Android apps when users reopen or refresh the app. This is not Capacitor's normal production packaging model; Capacitor documents `server.url` as intended for live reload. Keep using HTTPS, keep `cleartext` disabled, and do not add broad navigation or mixed-content exceptions.

## What Updates Automatically

Existing Android installs can receive:

- page layout and UI changes
- song, artist, dashboard, auth, and download web logic
- copy/text changes
- fixes that live entirely in the hosted web app

Users may need to close/reopen the Android app, depending on WebView caching.

## What Requires A New APK/AAB

Rebuild and redistribute Android when changing:

- app icon, splash screen, app name, package id, or native permissions
- Capacitor plugins or native Android files
- `capacitor.config.ts` values, including the hosted URL
- offline/background playback behaviour that depends on native APIs

## Build And Sync

```powershell
cd "C:\Users\BACKSPACE\Desktop\MAJOR PROJECTS\shy-music-source"
$env:CAPACITOR_SERVER_URL="https://kundaeliko99-byte.github.io/shy-music-source/"
npm run android:sync
```

## Open In Android Studio

```powershell
npm run android:open
```

Then use Android Studio to run the app on a connected phone or emulator.

## Build A Debug APK

```powershell
cd "C:\Users\BACKSPACE\Desktop\MAJOR PROJECTS\shy-music-source"
npm run android:build
```

The debug APK is created under:

```text
android\app\build\outputs\apk\debug\app-debug.apk
```

Install it with:

```powershell
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

## Verification

After installing:

1. Open the Android app.
2. Confirm it loads the GitHub Pages SHY app, not Lovable.
3. Sign in with Email/Phone.
4. Play a song.
5. Open a track share link.
6. Test one public free download.
7. Confirm no cleartext or mixed-content warning appears.
