import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.png', 'icons/apple-touch-icon.png', 'offline.html', 'images/logo.webp'],
      manifest: {
        id: '/',
        name: 'Mythree – संस्कृतगृहम्',
        short_name: 'Mythree',
        description: 'Learn Sanskrit chapter by chapter with Mythree – संस्कृतगृहम्.',
        lang: 'en-IN',
        start_url: '/?source=pwa',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        background_color: '#FBF6EC',
        theme_color: '#7A1F2B',
        categories: ['education'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Dashboard', url: '/app', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Daily challenge', url: '/app/challenges', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        // Only static, public build assets are precached. API / auth / payment traffic is never cached.
        globPatterns: ['**/*.{js,css,html,woff2,png,webp,svg}'],
        globIgnores: ['**/images/promo-1080.*', '**/images/og.jpg'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\/callback/],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/images/'),
            handler: 'CacheFirst',
            options: { cacheName: 'mythree-images', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3-')) return 'charts'
            if (id.includes('@supabase')) return 'supabase'
            if (id.includes('motion')) return 'motion'
            if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/')) return 'react'
          }
        },
      },
    },
  },
})
