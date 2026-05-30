import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

const apiProxy = {
  '/api': {
    target: process.env.VITE_API_PROXY ?? 'http://localhost:8000',
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // New SW activates and refreshes assets on every deploy — content-hashed
      // precache means no stale UI after a release (the structural fix for the
      // "alte-UI-gecacht"-Problem the manual SW was disabled for, Tim 2026-05-23).
      registerType: 'autoUpdate',
      injectRegister: false, // registered manually via virtual:pwa-register in main.tsx
      manifest: false, // keep the hand-written public/manifest.webmanifest
      workbox: {
        // App shell + hashed assets + icons + manifest → app starts offline.
        globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // NOTE: API responses are deliberately NOT runtime-cached (sensible
        // ticket data — DSGVO). Offline = app shell loads, data fetches fail
        // and the OfflineBanner is shown. Persistent offline-read of ticket
        // data is a separate decision (data-on-device trade-off).
      },
      devOptions: {
        enabled: false, // no SW during `vite dev` — avoids dev stale-cache pain
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: apiProxy,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    proxy: apiProxy,
  },
  build: {
    outDir: 'dist',
    // No production sourcemaps — they would ship the original TS source
    // (incl. sw.js.map) to clients. Re-enable as 'hidden' + Sentry upload when
    // error tracking (Schicht 9) is wired up.
    sourcemap: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'e2e'],
  },
});
