import path from "node:path";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { serwist } from "@serwist/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The service worker precaches what the build wrote, so both read the same folder.
// Tests build into a temporary one.
const outDir = process.env.AUDITOO_OUT_DIR ?? "dist";

export default defineConfig(({ command }) => ({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    serwist({
      swSrc: "src/sw.ts",
      swDest: "sw.js",
      globDirectory: outDir,
      // The whole shell is precached so the app opens with no network. Cyrillic and
      // Vietnamese font subsets stay out; Latin and Latin-extended cover EU accented names.
      globPatterns: ["**/*.{js,css,html,woff2,png,svg,ico,webmanifest}"],
      globIgnores: ["**/*cyrillic*", "**/*vietnamese*"],
      rollupFormat: "iife",
      // Not in dev: a cached shell would hide changes. Try it with `vite build` and `vite preview`.
      disable: command === "serve",
      // Not NODE_ENV: under test runners that would build the development worker.
      mode: "production",
    }),
  ],
  build: { outDir },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
}));
