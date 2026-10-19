import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { buildId } from './scripts/build-id.mjs';

export default defineConfig({
  base: '/lesson-ledger/', // D-03
  define: { __BUILD_ID__: JSON.stringify(buildId()) },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false, // registration comes only from the virtual:pwa-register/preact hook
      includeAssets: ['apple-touch-icon.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Lesson Ledger', // D-01
        short_name: 'Lesson Ledger',
        start_url: '/lesson-ledger/', // D-03: set explicitly, do not trust defaults
        scope: '/lesson-ledger/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F2F2F7',
        theme_color: '#F2F2F7',
        icons: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
