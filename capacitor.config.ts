import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.shymusic.mobile",
  appName: "SHY",
  webDir: "mobile",
  server: {
    // Capacitor wraps the deployed SHY web app so Android and web share
    // the same Supabase backend, accounts, songs, purchases, and updates.
    url: process.env.CAPACITOR_SERVER_URL || "https://shymusic.lovable.app",
    cleartext: false,
  },
  android: {
    backgroundColor: "#0A0A0F",
  },
};

export default config;
