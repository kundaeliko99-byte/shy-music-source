import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react(), tailwindcss(), tsConfigPaths()],
  build: {
    outDir: ".output/public",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: resolve(__dirname, "github-pages.html"),
      },
    },
  },
});
