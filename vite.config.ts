import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon/favicon-32x32.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Profissionaliza Gestão',
        short_name: 'Profissionaliza',
        description: 'Gestão educacional integrada da Profissionaliza.',
        theme_color: '#111744',
        background_color: '#F8F9FF',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'pt-BR',
        icons: [
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: []
      }
    })
  ],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('recharts') || id.includes('d3-')) return 'charts'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('@radix-ui') || id.includes('lucide-react')) return 'ui'
          if (id.includes('@tanstack')) return 'query'
        }
      }
    }
  }
})
