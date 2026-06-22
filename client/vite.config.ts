import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import { loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const sentryEnabled = Boolean(env.VITE_SENTRY_DSN)
  const posthogEnabled = Boolean(env.VITE_POSTHOG_KEY)

  // Prefer explicit origin. Fall back to legacy VITE_API_URL and normalize trailing /api.
  // Default API port should match current server default.
  // Override with VITE_API_ORIGIN or VITE_API_URL.
  const apiOriginRaw = env.VITE_API_ORIGIN || env.VITE_API_URL || 'http://localhost:3000'
  const apiProxyTarget = apiOriginRaw.replace(/\/api\/?$/, '')

  return {
    // Avoid writing cache under node_modules (can fail on some setups with restricted permissions)
    cacheDir: '.vite',
    plugins: [
      vue({
        template: {
          compilerOptions: {
            isCustomElement: (tag) => tag === 'emoji-picker',
          },
        },
      }),
      ...(mode === 'development' ? [vueDevTools()] : []),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        // Published "module" is UMD (`require("vue")`); Rollup interop in vendor-dnd can yield
        // "Object.defineProperty called on non-object" inside vue.cjs.prod.js. Source is plain ESM.
        vuedraggable: fileURLToPath(
          new URL('./node_modules/vuedraggable/src/vuedraggable.js', import.meta.url)
        ),
      },
    },
    // Add this proxy configuration:
    server: {
      // port: 5173,
      proxy: {
        '/api': {
          target: apiProxyTarget, // Your Express server origin
          changeOrigin: true,
          // rewrite: (path) => path.replace(/^\/api/, '') // Removes /api prefix when sending to backend
        },
        // Embed chat API (widget static files stay under /embed/chat.js and /embed/chat/widget.html).
        '^/embed/chat/(config|sessions)(/|\\?|$)': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        '^/embed/chat/sessions/[^/]+(/|\\?|$)': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        '^/embed/chat/sessions/[^/]+/(messages|typing|stream|close|journey|feedback)(/|\\?|$)': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        // Proxy portal REST only when the client sends Bearer auth (fetch/XHR).
        // Full page refresh hits the same paths as Vue routes (e.g. /portal/cases) without
        // Authorization — those must be served by the SPA, not the API.
        '^/portal/(me|org|health|audits|actions|cases|mailroom)(/|$)': {
          target: apiProxyTarget,
          changeOrigin: true,
          bypass(req) {
            const auth = req.headers?.authorization;
            const hasBearer =
              typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ');
            if (hasBearer) return null;

            const secFetchDest = req.headers?.['sec-fetch-dest'];
            if (secFetchDest === 'document') return '/index.html';

            const accept = String(req.headers?.accept || '');
            if (accept.includes('text/html')) return '/index.html';

            return null;
          },
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const auth = req.headers?.authorization;
              if (auth) proxyReq.setHeader('Authorization', auth);
            });
          },
        }
      }
    },
    build: {
    // App includes very large views (e.g. settings); 500 kB is easy to exceed.
    chunkSizeWarningLimit: 900,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/')) {
            if (sentryEnabled && id.includes('/node_modules/@sentry/')) {
              return 'vendor-sentry'
            }
            if (posthogEnabled && id.includes('/node_modules/posthog-js/')) {
              return 'vendor-posthog'
            }

            // Keep `vue`, `vue-router`, `pinia`, and all `@vue/*` in one chunk. The `vue` package is
            // only a re-export of `@vue/runtime-dom`; splitting them into separate manual chunks
            // creates a circular chunk graph and production TDZ errors (e.g. "Cannot access before
            // initialization" in runtime-core / vue-router).
            if (
              id.includes('/node_modules/vue/') ||
              id.includes('/node_modules/vue-router/') ||
              id.includes('/node_modules/pinia/') ||
              id.includes('/node_modules/@vue/')
            ) {
              return 'vendor-vue'
            }

            if (
              id.includes('/node_modules/@headlessui/') ||
              id.includes('/node_modules/@heroicons/')
            ) {
              return 'vendor-ui'
            }

            if (
              id.includes('/node_modules/@tiptap/') ||
              id.includes('/node_modules/prosemirror/')
            ) {
              return 'vendor-editor'
            }

            if (id.includes('/node_modules/@fullcalendar/')) {
              return 'vendor-calendar'
            }

            if (
              id.includes('/node_modules/chart.js/') ||
              id.includes('/node_modules/vue-chartjs/') ||
              id.includes('/node_modules/gridstack/')
            ) {
              return 'vendor-visual'
            }

            if (id.includes('/node_modules/@tanstack/')) {
              return 'vendor-tanstack'
            }

            if (id.includes('/node_modules/linkifyjs/')) {
              return 'vendor-linkify'
            }

            if (id.includes('/node_modules/preact/')) {
              return 'vendor-preact'
            }

            if (id.includes('/node_modules/@popperjs/core/')) {
              return 'vendor-popper'
            }

            if (id.includes('/node_modules/tippy.js/')) {
              return 'vendor-tippy'
            }

            if (id.includes('/node_modules/dompurify/')) {
              return 'vendor-dompurify'
            }

            if (
              id.includes('/node_modules/sortablejs/') ||
              id.includes('/node_modules/vuedraggable/')
            ) {
              return 'vendor-dnd'
            }

            return 'vendor-misc'
          }

          // Heavy settings UI — keep it out of the main entry chunk when possible
          if (
            id.includes('/src/components/settings/') ||
            id.includes('/src/views/settings/')
          ) {
            return 'chunk-settings'
          }

          if (
            id.includes('/src/components/record-page/') ||
            id.includes('/src/components/activity/')
          ) {
            return 'record-activity'
          }

          return undefined
        }
      }
    }
    },
    // resolve: { alias: { '@': path.resolve(__dirname, './src') } }
  }
})
