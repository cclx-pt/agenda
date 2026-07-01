import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'
import { loadUser } from './middleware/auth.js'
import { authRouter } from './auth/routes.js'
import { adminRouter } from './routes/admin.js'
import { inradarRouter } from './routes/inradar.js'
import { eventsRouter } from './events/routes.js'
import { integrationRouter } from './settings/routes.js'
import { usersRouter } from './users/routes.js'
import { reportsRouter } from './reports/routes.js'
import { churchesRouter } from './churches/routes.js'
import { categoriesRouter } from './categories/routes.js'
import { privacyTagsRouter } from './privacyTags/routes.js'
import { delegationsRouter } from './delegations/routes.js'
import { uploadsRouter } from './uploads/routes.js'
import { healthRouter } from './health/routes.js'

/**
 * app.js — constrói e exporta a aplicação Express já configurada (middleware +
 * rotas + tratamento de erros), SEM a pôr à escuta.
 *
 * É partilhada por dois pontos de entrada:
 *   - `index.js`       → arranque local/standalone (chama app.listen()).
 *   - `serverless.js`  → função serverless do Vercel (export default app).
 */
export const app = express()

// Atrás de um proxy (Vercel/Nginx): confia no primeiro proxy para obter o IP
// real (rate-limit) e o protocolo correto (cookies "secure").
if (config.isProd) {
  app.set('trust proxy', 1)
}

app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
)
app.use(express.json())
app.use(cookieParser())
app.use(loadUser)

// Estado dos serviços: /health (liveness), /health/full (componentes) e
// /health/logs (registo de reinícios — usado pela página pública /logs).
app.use('/health', healthRouter)

app.use('/api', inradarRouter)
app.use('/auth', authRouter)
app.use('/data', adminRouter)
app.use('/data/integration', integrationRouter)
app.use('/data/users', usersRouter)
app.use('/data/reports', reportsRouter)
app.use('/data/events', eventsRouter)
app.use('/data/churches', churchesRouter)
app.use('/data/categories', categoriesRouter)
app.use('/data/privacy-tags', privacyTagsRouter)
app.use('/data/delegations', delegationsRouter)
// Imagens de eventos: carregadas (POST) para o Supabase Storage, que serve os
// URLs públicos diretamente — já não há ficheiros locais a servir.
app.use('/data/uploads', uploadsRouter)

// ── Frontend (build do Vite) ─────────────────────────────────────
// Só serve o frontend compilado quando o `dist/` existe — ou seja, quando se
// corre como UMA app Node (local/standalone, ex.: `npm start`). No Vercel o
// `dist/` é servido pela CDN e NÃO entra no bundle da função serverless, por
// isso `fs.existsSync` devolve false e este bloco é ignorado (a função trata
// apenas de /api, /auth, /data e /health). O caminho pode ajustar-se com
// CLIENT_DIST; por omissão é a pasta `dist/` na raiz do repositório.
const here = path.dirname(fileURLToPath(import.meta.url))
const clientDist = process.env.CLIENT_DIST
  ? path.resolve(process.env.CLIENT_DIST)
  : path.resolve(here, '../../dist')

if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist))
  // Fallback SPA: qualquer rota que não seja da API devolve o index.html.
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/data') ||
      req.path.startsWith('/auth') ||
      req.path.startsWith('/health')
    ) {
      return next()
    }
    res.sendFile(path.join(clientDist, 'index.html'))
  })
  console.log(`[server] A servir o frontend de ${clientDist}`)
}

// Tratamento de erros centralizado (tem de ser o último middleware).
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[server] erro:', err)
  res.status(500).json({ error: 'Erro interno do servidor.' })
})
