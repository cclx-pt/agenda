import { Router } from 'express'
import { z } from 'zod'
import multer from 'multer'
import { requireAuth, requireRole } from '../middleware/auth.js'
import * as service from './service.js'
import { InviteError } from './service.js'
import * as payments from './payments/service.js'
import { uploadImage, isStorageConfigured } from '../storage/supabase.js'

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

// Comprovativos de pagamento: PDF/PNG/JPG até 5MB, em memória (→ Supabase Storage).
const RECEIPT_TYPES = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['application/pdf', '.pdf'],
])
const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    RECEIPT_TYPES.has(file.mimetype) ? cb(null, true) : cb(new Error('Formato inválido. Apenas PDF, PNG ou JPG.')),
})

const guestToken = (req) => (typeof req.query.g === 'string' ? req.query.g : undefined)

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

// ── Pagamentos (organizador) ────────────────────────────────────
invitesRouter.get(
  '/:id/payments',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ payments: await payments.listPayments(req.user, req.params.id) })
  })
)

invitesRouter.post(
  '/payments/:paymentId/validate',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ payment: await payments.validatePayment(req.user, req.params.paymentId) })
  })
)

invitesRouter.post(
  '/payments/:paymentId/reject',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ payment: await payments.rejectPayment(req.user, req.params.paymentId) })
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

// ── Pagamentos (convidado, autenticado pelo token pessoal ?g=) ──
// Callback assíncrono de um conector real (o conector valida a assinatura).
publicInvitesRouter.post(
  '/webhook/:provider',
  asyncHandler(async (req, res) => {
    res.json(await payments.handleWebhook(req.params.provider, req))
  })
)

// Estado do pagamento do convidado.
publicInvitesRouter.get(
  '/:slug/payment',
  asyncHandler(async (req, res) => {
    res.json({ payment: await payments.getForGuest(req.params.slug, guestToken(req)) })
  })
)

// Iniciar um pagamento (escolher método) — devolve instruções/referência.
publicInvitesRouter.post(
  '/:slug/payment',
  asyncHandler(async (req, res) => {
    res.status(201).json({ payment: await payments.initiate(req.params.slug, guestToken(req), req.body) })
  })
)

// Carregar o comprovativo (transferência) — multipart, campo "file".
publicInvitesRouter.post('/:slug/payment/receipt', (req, res) => {
  receiptUpload.single('file')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Ficheiro demasiado grande (máx. 5MB).' : 'Falha no upload.'
      return res.status(400).json({ error: message })
    }
    if (err) return res.status(400).json({ error: err.message || 'Falha no upload.' })
    if (!req.file) return res.status(400).json({ error: 'Nenhum ficheiro recebido.' })
    if (!isStorageConfigured()) return res.status(503).json({ error: 'Armazenamento não configurado.' })
    try {
      const ext = RECEIPT_TYPES.get(req.file.mimetype) ?? '.bin'
      const url = await uploadImage(req.file.buffer, { ext, contentType: req.file.mimetype })
      const payment = await payments.attachReceipt(req.params.slug, guestToken(req), url)
      res.status(201).json({ payment })
    } catch (uploadErr) {
      if (uploadErr instanceof InviteError) return res.status(uploadErr.status).json({ error: uploadErr.message })
      console.error('[invites] comprovativo:', uploadErr?.message ?? uploadErr)
      res.status(502).json({ error: 'Falha ao guardar o comprovativo.' })
    }
  })
})
