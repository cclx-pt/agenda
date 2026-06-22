import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
      css: true,
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
