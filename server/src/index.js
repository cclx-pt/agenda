import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
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
import { uploadsRouter, uploadsDir } from './uploads/routes.js'

const app = express()

// Atrás do Nginx (VPS): confia no primeiro proxy para obter o IP real
// (rate-limit) e o protocolo correto (cookies secure).
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

app.get('/health', (_req, res) => res.json({ ok: true }))

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
// Imagens carregadas: servidas estaticamente (GET) e endpoint de upload (POST).
app.use('/data/uploads', express.static(uploadsDir))
app.use('/data/uploads', uploadsRouter)

// Tratamento de erros centralizado.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[server] erro:', err)
  res.status(500).json({ error: 'Erro interno do servidor.' })
})

app.listen(config.port, () => {
  console.log(`[server] Agenda CCLX backend a correr em http://localhost:${config.port}`)
})
