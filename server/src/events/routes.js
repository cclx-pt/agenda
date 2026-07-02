import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth.js'
import * as service from './service.js'
import { EventError } from './service.js'
import { buildCalendar } from './ics.js'

export const eventsRouter = Router()

// Envolve handlers async: erros de domínio/validação viram respostas HTTP;
// o resto segue para o middleware de erro central.
function asyncHandler(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res)
    } catch (err) {
      if (err instanceof EventError) {
        const body = { error: err.message }
        if (err.overlaps) body.overlaps = err.overlaps
        if (err.overlapMode) body.overlapMode = err.overlapMode
        return res.status(err.status).json(body)
      }
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.issues[0]?.message ?? 'Dados inválidos.' })
      }
      next(err)
    }
  }
}

const manageRoles = requireRole('admin', 'aprovador', 'editor')

// Extrai um intervalo de datas (YYYY-MM-DD) dos query params, se presente.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
function dateRange(query) {
  const from = DATE_RE.test(query.from ?? '') ? query.from : undefined
  const to = DATE_RE.test(query.to ?? '') ? query.to : undefined
  return { from, to }
}

// Valida que :id é um UUID antes de chegar à BD (evita erro 500 do Postgres
// em ids malformados; responde 404 como recurso inexistente).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
eventsRouter.param('id', (req, res, next, id) => {
  if (!UUID_RE.test(id)) {
    return res.status(404).json({ error: 'Evento não encontrado.' })
  }
  next()
})

// ── Público: agenda publicada (não privada) ─────────────────────
eventsRouter.get(
  '/public',
  asyncHandler(async (req, res) => {
    res.json({ events: await service.listPublic(dateRange(req.query)) })
  })
)
// Feed de subscrição (iCalendar) dos eventos públicos — PÚBLICO, sem sessão. Os
// apps de calendário (Google/Apple/Outlook) leem este URL periodicamente. Janela
// por omissão: do mês passado até ~14 meses à frente (ajustável por ?from/&to).
eventsRouter.get('/calendar.ics', async (req, res, next) => {
  try {
    const ymd = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const now = new Date()
    const range = dateRange(req.query)
    const from = range.from || ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1))
    const to = range.to || ymd(new Date(now.getFullYear() + 1, now.getMonth() + 2, 0))
    const events = await service.listPublic({ from, to })
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Content-Disposition', 'inline; filename="agenda-cclx.ics"')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.send(buildCalendar(events, { name: 'Agenda CCLX' }))
  } catch (err) {
    next(err)
  }
})
// Categorias distintas em uso (qualquer estado + externos) — alimenta o filtro
// dinâmico da barra lateral. Público: o calendário anónimo também o usa.
eventsRouter.get(
  '/categories-in-use',
  asyncHandler(async (_req, res) => {
    res.json({ categories: await service.categoriesInUse() })
  })
)

// A partir daqui, tudo exige autenticação.
eventsRouter.use(requireAuth)

// ── Calendário autenticado: publicados, incluindo privados se autorizado ──
eventsRouter.get(
  '/calendar',
  asyncHandler(async (req, res) => {
    const includeDrafts = req.query.drafts === 'true' || req.query.drafts === '1'
    const { from, to } = dateRange(req.query)
    res.json({ events: await service.listCalendar(req.user, { includeDrafts, from, to }) })
  })
)

// Painel de aprovações: eventos que o utilizador pode moderar, por estado.
eventsRouter.get(
  '/approvals',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ events: await service.listForApproval(req.user, { status: req.query.status }) })
  })
)

// Pré-visualização de sobreposições (aviso em tempo real no formulário).
eventsRouter.get(
  '/overlaps',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json(await service.overlapsPreview(req.user, req.query))
  })
)

eventsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ events: await service.listForUser(req.user) })
  })
)

eventsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ event: await service.getForUser(req.user, req.params.id) })
  })
)

eventsRouter.get(
  '/:id/history',
  asyncHandler(async (req, res) => {
    await service.getForUser(req.user, req.params.id) // valida acesso
    res.json({ history: await service.history(req.params.id) })
  })
)

eventsRouter.post(
  '/',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.status(201).json({ event: await service.create(req.user, req.body) })
  })
)

eventsRouter.put(
  '/:id',
  manageRoles,
  asyncHandler(async (req, res) => {
    const scope = req.query.scope === 'series' ? 'series' : undefined
    res.json({ event: await service.update(req.user, req.params.id, req.body, { scope }) })
  })
)

eventsRouter.delete(
  '/:id',
  manageRoles,
  asyncHandler(async (req, res) => {
    const scope = req.query.scope === 'series' ? 'series' : undefined
    await service.remove(req.user, req.params.id, { scope })
    res.json({ ok: true })
  })
)

// ── Fluxo de aprovação ───────────────────────────────────────────
eventsRouter.post(
  '/:id/submit',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ event: await service.submit(req.user, req.params.id) })
  })
)

eventsRouter.post(
  '/:id/approve',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ event: await service.approve(req.user, req.params.id) })
  })
)

eventsRouter.post(
  '/:id/reject',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ event: await service.reject(req.user, req.params.id, req.body?.reason) })
  })
)
