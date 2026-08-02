import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// The version shown in App Info needs to actually change every deploy —
// package.json's version is hand-maintained and easy to forget to bump, so
// instead embed the current git commit's short hash at build time. GitHub
// Actions checks out full history so this is always available there; falls
// back to "dev" for local builds without git (or a shallow/missing repo).
function getBuildId(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(getBuildId()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg"],
      manifest: {
        id: "/",
        name: "Client Totals",
        short_name: "Client Totals",
        description: "Groups, periods and client tracking app",
        theme_color: "#0a1830",
        background_color: "#0a1830",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        cleanupOutdatedCaches: true,
        // Deliberately NOT set: a newly-activating worker with
        // clientsClaim: true immediately calls clients.claim(), which
        // hijacks control of whatever page is loading RIGHT NOW —
        // including the WebAPK's own launch navigation itself. That
        // forces a controllerchange event mid-navigation, right during
        // the window Chrome is verifying the WebAPK/TWA's Digital Asset
        // Link association for this launch. Without it, an activating
        // worker only starts controlling pages from the *next* full
        // navigation onward, so the launch navigation itself is never
        // hijacked mid-flight by this.
        navigateFallback: "/index.html",
      },
    }),
  ],
});
