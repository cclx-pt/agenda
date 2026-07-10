import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth.js'
import * as service from './service.js'
import { InviteError } from './service.js'

// Envolve handlers async: erros de domínio/validação viram respostas HTTP.
function asyncHandler(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res)
    } catch (err) {
      if (err instanceof InviteError) {
        return res.status(err.status).json({ error: err.message })
      }
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.issues[0]?.message ?? 'Dados inválidos.' })
      }
      next(err)
    }
  }
}

const manageRoles = requireRole('admin', 'aprovador', 'editor')
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── Rotas de gestão (autenticadas) — /data/invites ──────────────
export const invitesRouter = Router()
invitesRouter.use(requireAuth)

invitesRouter.param('id', (req, res, next, id) => {
  if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Convite não encontrado.' })
  next()
})

invitesRouter.get(
  '/',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ invites: await service.listForUser(req.user) })
  })
)

invitesRouter.post(
  '/',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.status(201).json({ invite: await service.create(req.user, req.body) })
  })
)

invitesRouter.get(
  '/:id',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ invite: await service.getForEditor(req.user, req.params.id) })
  })
)

invitesRouter.put(
  '/:id',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ invite: await service.update(req.user, req.params.id, req.body) })
  })
)

invitesRouter.put(
  '/:id/blocks',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ invite: await service.replaceBlocks(req.user, req.params.id, req.body) })
  })
)

invitesRouter.post(
  '/:id/publish',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ invite: await service.publish(req.user, req.params.id) })
  })
)

invitesRouter.post(
  '/:id/status',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ invite: await service.setStatus(req.user, req.params.id, req.body?.status) })
  })
)

invitesRouter.get(
  '/:id/preview',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ page: await service.getPreview(req.user, req.params.id) })
  })
)

invitesRouter.get(
  '/:id/guests',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ guests: await service.listGuests(req.user, req.params.id) })
  })
)

invitesRouter.delete(
  '/:id',
  manageRoles,
  asyncHandler(async (req, res) => {
    await service.remove(req.user, req.params.id)
    res.json({ ok: true })
  })
)

// ── Rotas públicas (sem sessão) — /data/public/invite ───────────
export const publicInvitesRouter = Router()

// GET /data/public/invite/:slug?g=<guestToken> — payload da página pública.
publicInvitesRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const { invite, payload } = await service.getPublicBySlug(req.params.slug, {
      guestToken: typeof req.query.g === 'string' ? req.query.g : undefined,
    })
    // Regista a visualização (fire-and-forget, não bloqueia a resposta).
    service.recordView(invite.id, { referer: req.get('referer'), userAgent: req.get('user-agent') })
    res.json({ page: payload })
  })
)

// GET /data/public/invite/:slug/meta — só Open Graph (crawlers/pré-visualização).
publicInvitesRouter.get(
  '/:slug/meta',
  asyncHandler(async (req, res) => {
    res.json({ meta: await service.getMeta(req.params.slug) })
  })
)

// POST /data/public/invite/:slug/rsvp — submete a inscrição do convidado.
publicInvitesRouter.post(
  '/:slug/rsvp',
  asyncHandler(async (req, res) => {
    res.status(201).json(await service.submitRsvp(req.params.slug, req.body))
  })
)
