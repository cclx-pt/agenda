import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      // Ambiente de deploy (Vercel injeta estas no build):
      //   VERCEL_ENV = production | preview | development
      //   VERCEL_GIT_COMMIT_REF = nome do branch
      // Localmente ficam 'local' / '' → o crachá de ambiente aparece exceto em produção.
      __APP_ENV__: JSON.stringify(process.env.VERCEL_ENV || 'local'),
      __GIT_BRANCH__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_REF || ''),
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
      css: true,
      // Apenas os testes do frontend. O backend tem o seu próprio runner
      // (cd server && npm test, via node --test) e precisa de BD + env.
      include: ['src/**/*.{test,spec}.{js,jsx}'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'data-vendor': ['@tanstack/react-query', 'zod'],
            'ui-vendor': ['framer-motion', 'sonner'],
            'search-vendor': ['fuse.js', 'date-fns'],
          },
        },
      },
    },
    server: {
      proxy: {
        // Backend próprio (System of Record): auth, papéis e gestão da agenda.
        '/auth': {
          target: env.BACKEND_URL || 'http://localhost:4000',
          changeOrigin: true,
        },
        '/data': {
          target: env.BACKEND_URL || 'http://localhost:4000',
          changeOrigin: true,
        },
        // Estado dos serviços (lights + página /logs).
        '/health': {
          target: env.BACKEND_URL || 'http://localhost:4000',
          changeOrigin: true,
        },
        '/api': {
          target: 'https://inradar.com.br/public/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          configure: (proxy) => {
            const key = env.INCHURCH_API_KEY
            const secret = env.INCHURCH_API_SECRET
            const encoded = Buffer.from(`${key}:${secret}`).toString('base64')
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Authorization', `Basic ${encoded}`)
              proxyReq.setHeader('X-API-Version', 'v1')
            })
          }
        }
      }
    }
  }
})
