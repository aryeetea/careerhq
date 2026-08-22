import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest, not the default generateSW: Bloom's service
      // worker (src/sw.ts) needs its own hand-written push/
      // notificationclick handlers (see PUSH NOTIFICATIONS there) —
      // generateSW only ever produces a Workbox-authored worker with no
      // room for that.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectManifest: {
        // Keep the precache list to real app code/styles, not every
        // asset in the build — large media (none currently, but future
        // resume/avatar-adjacent assets live in Supabase Storage, not
        // this bundle) shouldn't get pinned into the install-time cache.
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
      },
      registerType: "autoUpdate",
      injectRegister: false, // registered explicitly in src/main.tsx instead
      devOptions: {
        // Off in dev: an actively-updating service worker fighting HMR
        // is more confusing than useful while developing.
        enabled: false,
      },
      manifest: {
        name: "Bloom — grow your career, gently",
        short_name: "Bloom",
        description:
          "Bloom is a calm, elegant space to grow your career — save roles worth pursuing, nurture every application, and celebrate progress as it happens.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        // Matches the existing <meta name="theme-color"> in index.html
        // and the Floral theme's own ivory background (see useTheme.tsx)
        // — the installed app's chrome/splash should match what the app
        // already looks like on first load, before any saved theme
        // preference is known.
        background_color: "#fbf3ea",
        theme_color: "#fbf3ea",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-forms": ["react-hook-form", "@hookform/resolvers", "zod"],
          "vendor-dnd": ["@dnd-kit/core", "@dnd-kit/utilities"],
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
