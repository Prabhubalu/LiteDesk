import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },

  // =========================================================
  // CRITICAL FIX: Add the CSS block to enable PostCSS processing
  // =========================================================
  css: {
    postcss: {},
    // TEMPORARILY ADDED: This can sometimes force path resolution in Vite
        devSourcemap: true,
  },
  // Add this proxy configuration:
  server: {
    // port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Your Express server
        changeOrigin: true,
        // rewrite: (path) => path.replace(/^\/api/, '') // Removes /api prefix when sending to backend
      }
    }
  },
  // resolve: { alias: { '@': path.resolve(__dirname, './src') } }
})
