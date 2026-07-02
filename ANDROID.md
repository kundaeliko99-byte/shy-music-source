# SHY Android App

SHY uses Capacitor for Android. The Android app wraps the deployed SHY web app so it remains connected to the same Supabase backend, accounts, songs, purchase requests, and profile data as the web app.

## Required Tools

1. Node.js and npm
2. Java JDK 17 or newer
3. Android Studio with Android SDK
4. USB debugging enabled on your Android phone

## Configure Target URL

Set this to your deployed SHY website before building a test APK:

```powershell
$env:CAPACITOR_SERVER_URL="https://your-deployed-shy-domain.example"
```

If you do not set it, the current default is `https://shymusic.lovable.app`.

## Build and Sync

```powershell
cd "C:\Users\BACKSPACE\Desktop\MAJOR PROJECTS\shy-music-source"
npm run build
npm run android:sync
```

## Open in Android Studio

```powershell
npm run android:open
```

Then use Android Studio to run the app on a connected phone or emulator.

## Build a Debug APK

After Android Studio/JDK are installed:

```powershell
cd "C:\Users\BACKSPACE\Desktop\MAJOR PROJECTS\shy-music-source\android"
.\gradlew.bat assembleDebug
```

The debug APK will be created under:

```text
android\app\build\outputs\apk\debug\app-debug.apk
```

Install it with:

```powershell
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```
