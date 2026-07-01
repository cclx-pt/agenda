import { Router } from 'express'
import { checkDb, listRestarts } from './repository.js'
import { verifySmtp } from '../auth/email.js'
import { verifyStorage } from '../storage/supabase.js'

export const healthRouter = Router()

// Liveness simples — usado pela plataforma de hosting e pelo modo diagnóstico
// do server.js (raiz). Mantém-se leve (não toca na BD).
healthRouter.get('/', (_req, res) => res.json({ ok: true }))

// Estado detalhado dos componentes — alimenta os "sinais" (lights) no frontend.
healthRouter.get('/full', async (_req, res) => {
  const [db, smtp, storage] = await Promise.all([checkDb(), verifySmtp(), verifyStorage()])
  const uptimeSeconds = Math.round(process.uptime())
  res.json({
    ok: db.ok,
    server: 'up',
    db: db.ok ? 'up' : 'down',
    dbError: db.ok ? undefined : db.error,
    // SMTP: 'up' = ligação/credenciais OK; 'down' = configurado mas a falhar;
    // 'unknown' = sem SMTP configurado (modo consola, login não envia emails).
    smtp: smtp.ok ? 'up' : smtp.configured ? 'down' : 'unknown',
    smtpError: smtp.ok ? undefined : smtp.error,
    smtpConfigured: smtp.configured,
    // Storage: 'up' = bucket acessível; 'down' = configurado mas a falhar;
    // 'unknown' = SUPABASE_URL/SERVICE_ROLE_KEY em falta.
    storage: storage.ok ? 'up' : storage.configured ? 'down' : 'unknown',
    storageError: storage.ok ? undefined : storage.error,
    storageConfigured: storage.configured,
    uptimeSeconds,
    startedAt: new Date(Date.now() - uptimeSeconds * 1000).toISOString(),
    nodeEnv: process.env.NODE_ENV ?? null,
    time: new Date().toISOString(),
  })
})

// Registo de reinícios do servidor (página /logs).
healthRouter.get('/logs', async (req, res, next) => {
  try {
    const restarts = await listRestarts(req.query.limit)
    res.json({ restarts })
  } catch (err) {
    next(err)
  }
})
