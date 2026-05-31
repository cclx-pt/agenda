import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      proxy: {
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
