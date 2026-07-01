import { Router } from 'express'
import { z } from 'zod'
import { requireRole } from '../middleware/auth.js'
import { config } from '../config.js'
import { runSync, purgeExternal } from '../integrations/inchurchSync.js'
import * as service from './service.js'

export const integrationRouter = Router()

const adminOnly = requireRole('admin')

// Estado público da integração (sem autenticação): o calendário usa-o para
// decidir se carrega os eventos da inChurch.
integrationRouter.get('/public', async (_req, res, next) => {
  try {
    const { enabled } = await service.getRawIntegration()
    res.json({ enabled })
  } catch (err) {
    next(err)
  }
})

integrationRouter.get('/', adminOnly, async (_req, res, next) => {
  try {
    res.json({ integration: await service.getIntegration() })
  } catch (err) {
    next(err)
  }
})

integrationRouter.put('/', adminOnly, async (req, res, next) => {
  try {
    const integration = await service.updateIntegration(req.body, req.user.sub)
    res.json({ integration })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues[0]?.message ?? 'Dados inválidos.' })
    }
    next(err)
  }
})

// Sincronização manual (admin): força uma sincronização imediata, ignorando o
// intervalo configurado. Devolve o resumo (contagens ou motivo de salto/erro).
integrationRouter.post('/sync', adminOnly, async (_req, res, next) => {
  try {
    const result = await runSync({ force: true })
    res.json({ result })
  } catch (err) {
    next(err)
  }
})

// Purga manual (admin): remove TODOS os eventos externos da base de dados.
// Não depende das credenciais nem do interruptor — permite limpar mesmo com a
// integração desativada.
integrationRouter.post('/purge', adminOnly, async (_req, res, next) => {
  try {
    const result = await purgeExternal()
    res.json({ result })
  } catch (err) {
    next(err)
  }
})

// Sincronização agendada (Vercel Cron / serviço externo): sem sessão de
// utilizador, protegida por CRON_SECRET. Respeita o intervalo configurado
// (não força). O Vercel Cron envia "Authorization: Bearer <CRON_SECRET>".
integrationRouter.get('/sync/cron', async (req, res, next) => {
  try {
    const secret = config.cron?.secret
    if (secret) {
      const auth = req.get('authorization') || ''
      const provided = auth.startsWith('Bearer ')
        ? auth.slice(7)
        : req.get('x-cron-secret') || ''
      if (provided !== secret) {
        return res.status(401).json({ error: 'Não autorizado.' })
      }
    } else if (config.isProd) {
      // Em produção sem CRON_SECRET, recusa por segurança (endpoint sem sessão).
      return res.status(503).json({ error: 'CRON_SECRET não configurado no servidor.' })
    }
    const result = await runSync({ force: false })
    res.json({ result })
  } catch (err) {
    next(err)
  }
})

// ── Traduções (i18n) ──────────────────────────────
// GET público (a app precisa das traduções antes do login); PUT só admin.
export const translationsRouter = Router()

translationsRouter.get('/', async (_req, res, next) => {
  try {
    res.json({ translations: await service.getTranslations() })
  } catch (err) {
    next(err)
  }
})

translationsRouter.put('/', adminOnly, async (req, res, next) => {
  try {
    const translations = await service.updateTranslations(
      req.body?.translations ?? req.body,
      req.user.sub
    )
    res.json({ translations })
  } catch (err) {
    next(err)
  }
})

// ── Marca / logótipo ──────────────────────────────
// GET público (a app e o ecrã de carregamento precisam do logótipo); PUT só admin.
export const brandingRouter = Router()

brandingRouter.get('/', async (_req, res, next) => {
  try {
    res.json({ branding: await service.getBranding() })
  } catch (err) {
    next(err)
  }
})

brandingRouter.put('/', adminOnly, async (req, res, next) => {
  try {
    const branding = await service.updateBranding(req.body?.branding ?? req.body, req.user.sub)
    res.json({ branding })
  } catch (err) {
    next(err)
  }
})
