import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.shymusic.mobile",
  appName: "SHYMusic Creative",
  webDir: "mobile",
  server: {
    // Capacitor wraps the deployed SHY web app so Android and web share
    // the same Supabase backend, accounts, songs, purchases, and updates.
    url:
      process.env.CAPACITOR_SERVER_URL ||
      "https://kundaeliko99-byte.github.io/shy-music-source/",
    cleartext: false,
  },
  android: {
    backgroundColor: "#0A0A0F",
  },
};

export default config;
