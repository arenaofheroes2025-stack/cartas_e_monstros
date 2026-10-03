import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['icon.svg'],
    manifest: {
      name: 'Cartas e Monstros',
      short_name: 'Cartas',
      description: 'Explore, capture e evolua monstros em um mundo vivo.',
      theme_color: '#111d2a',
      background_color: '#111d2a',
      display: 'standalone',
      id: '/',
      start_url: '/',
      scope: '/',
      lang: 'pt-BR',
      orientation: 'landscape',
      icons: [
        { src: '/art/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: '/art/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
      ]
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,webp}'],
      navigateFallbackDenylist: [/^\/qa-(?:sombras|posicao-assets)\.html$/]
    }
  })],
  build: { rollupOptions: { input: {
    game: 'index.html',
    shadowLab: 'qa-sombras.html',
    assetPositionLab: 'qa-posicao-assets.html'
  } } },
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'] }
});
