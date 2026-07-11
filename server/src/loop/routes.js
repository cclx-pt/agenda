import { Router } from 'express'
import { requireRole } from '../middleware/auth.js'
import * as settings from '../settings/service.js'
import * as eventsRepo from '../events/repository.js'
import * as churchesRepo from '../churches/repository.js'

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// ── Página pública do Loop de uma igreja (para TV) ───────────────
// Eventos publicados marcados para o Loop, da própria comunidade + (se
// ativado) os eventos "gerais", nas próximas N semanas. Sem autenticação.
export const loopRouter = Router()

loopRouter.get('/:slug', async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').trim()
    if (!slug) return res.status(404).json({ error: 'Loop não indicado.' })
    const cfg = await settings.getLoopBySlug(slug)
    if (!cfg || !cfg.active) {
      return res.json({ active: false, church: cfg?.community || slug, weeks: cfg?.weeks ?? 4, format: cfg?.format ?? '16:9', secondsPerSlide: cfg?.secondsPerSlide ?? 15, secondsPerSlideFeatured: cfg?.secondsPerSlideFeatured ?? 30, events: [] })
    }
    const now = new Date()
    const end = new Date(now)
    end.setDate(end.getDate() + cfg.weeks * 7)
    const events = await eventsRepo.listForLoop({
      // community vazia = todas as igrejas (sem filtro por comunidade).
      church: cfg.community || undefined,
      includeGeneral: cfg.showGeneral,
      from: ymd(now),
      to: ymd(end),
    })
    res.setHeader('Cache-Control', 'public, max-age=120')
    res.json({ active: true, church: cfg.community || cfg.name, weeks: cfg.weeks, format: cfg.format, secondsPerSlide: cfg.secondsPerSlide, secondsPerSlideFeatured: cfg.secondsPerSlideFeatured, events })
  } catch (err) {
    next(err)
  }
})

// ── Configuração do Loop por comunidade (admin) ──────────────────
export const loopConfigRouter = Router()
const adminOnly = requireRole('admin')

loopConfigRouter.get('/', adminOnly, async (_req, res, next) => {
  try {
    const [config, churches] = await Promise.all([
      settings.getLoopConfig(),
      churchesRepo.listNames(),
    ])
    res.json({ config, churches })
  } catch (err) {
    next(err)
  }
})

loopConfigRouter.put('/', adminOnly, async (req, res, next) => {
  try {
    const config = await settings.updateLoopConfig(req.body?.config ?? req.body, req.user.sub)
    res.json({ config })
  } catch (err) {
    next(err)
  }
})
