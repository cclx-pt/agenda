import { Router } from 'express'
import { z } from 'zod'
import multer from 'multer'
import { requireAuth } from '../middleware/auth.js'
import * as service from './service.js'
import { InviteError } from './service.js'
import * as payments from './payments/service.js'
import * as campaigns from './campaigns/service.js'
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

// Gerir convites: administradores (sempre) ou utilizadores com a flag
// can_manage_invites. Substitui o antigo gate por papel.
const manageRoles = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Autenticação necessária.' })
  if (req.user.role === 'admin' || req.user.canManageInvites) return next()
  return res.status(403).json({ error: 'Sem permissão para gerir convites.' })
}
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

invitesRouter.param('guestId', (req, res, next, id) => {
  if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Inscrição não encontrada.' })
  next()
})

invitesRouter.param('campaignId', (req, res, next, id) => {
  if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Comunicação não encontrada.' })
  next()
})

invitesRouter.get(
  '/',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ invites: await service.listForUser(req.user) })
  })
)

// Eventos publicados/futuros associáveis a um convite (registado ANTES de /:id).
invitesRouter.get(
  '/selectable-events',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ events: await service.listSelectableEvents(req.user) })
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

// ── Comunicações operacionais por email ────────────────────────
invitesRouter.get('/:id/campaigns', manageRoles, asyncHandler(async (req, res) => {
  res.json({ campaigns: await campaigns.list(req.user, req.params.id) })
}))

invitesRouter.post('/:id/campaigns', manageRoles, asyncHandler(async (req, res) => {
  res.status(201).json({ campaign: await campaigns.create(req.user, req.params.id, req.body) })
}))

invitesRouter.post('/:id/campaigns/audience-preview', manageRoles, asyncHandler(async (req, res) => {
  res.json({ audience: await campaigns.previewAudience(req.user, req.params.id, req.body) })
}))

invitesRouter.get('/:id/campaigns/:campaignId', manageRoles, asyncHandler(async (req, res) => {
  res.json({ campaign: await campaigns.find(req.user, req.params.id, req.params.campaignId) })
}))

invitesRouter.put('/:id/campaigns/:campaignId', manageRoles, asyncHandler(async (req, res) => {
  res.json({ campaign: await campaigns.update(req.user, req.params.id, req.params.campaignId, req.body) })
}))

invitesRouter.delete('/:id/campaigns/:campaignId', manageRoles, asyncHandler(async (req, res) => {
  await campaigns.remove(req.user, req.params.id, req.params.campaignId)
  res.json({ ok: true })
}))

invitesRouter.post('/:id/campaigns/:campaignId/test', manageRoles, asyncHandler(async (req, res) => {
  res.json({ result: await campaigns.sendTest(req.user, req.params.id, req.params.campaignId, req.body) })
}))

invitesRouter.post('/:id/campaigns/:campaignId/send', manageRoles, asyncHandler(async (req, res) => {
  res.json({ campaign: await campaigns.send(req.user, req.params.id, req.params.campaignId) })
}))

// Edita uma inscrição (nome/email/telemóvel/estado).
invitesRouter.put(
  '/:id/guests/:guestId',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ guest: await service.updateGuest(req.user, req.params.id, req.params.guestId, req.body) })
  })
)

// Cancela uma inscrição (estado 'declined').
invitesRouter.post(
  '/:id/guests/:guestId/cancel',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ guest: await service.cancelGuest(req.user, req.params.id, req.params.guestId) })
  })
)

// Marca o reembolso de uma inscrição como concluído.
invitesRouter.post(
  '/:id/guests/:guestId/refunded',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ guest: await service.markGuestRefunded(req.user, req.params.id, req.params.guestId) })
  })
)

// Elimina uma inscrição.
invitesRouter.delete(
  '/:id/guests/:guestId',
  manageRoles,
  asyncHandler(async (req, res) => {
    await service.removeGuest(req.user, req.params.id, req.params.guestId)
    res.json({ ok: true })
  })
)

// ── Bilhetes (organizador) ──────────────────────────────
invitesRouter.get(
  '/:id/tickets',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ tickets: await service.listTickets(req.user, req.params.id) })
  })
)

invitesRouter.put(
  '/:id/tickets',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ tickets: await service.saveTickets(req.user, req.params.id, req.body) })
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

// ── Check-in (validação à entrada) ─────────────────────
invitesRouter.get(
  '/:id/checkin/lookup',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ result: await service.checkinLookup(req.user, req.params.id, req.query.code) })
  })
)

invitesRouter.post(
  '/:id/checkin/:guestId',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ guest: await service.acceptCheckin(req.user, req.params.id, req.params.guestId, { on: req.body?.on !== false }) })
  })
)

// Link de check-in móvel: gerar/obter (cria na 1ª vez) e rodar (revoga o antigo).
invitesRouter.get(
  '/:id/checkin/link',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ link: await service.getCheckinLink(req.user, req.params.id) })
  })
)

invitesRouter.post(
  '/:id/checkin/link/regenerate',
  manageRoles,
  asyncHandler(async (req, res) => {
    res.json({ link: await service.regenerateCheckinLink(req.user, req.params.id) })
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

// ── Auto-gestão da inscrição (código de reserva + senha) ────────
// POST /manage — login: devolve o resumo da inscrição.
publicInvitesRouter.post(
  '/:slug/manage',
  asyncHandler(async (req, res) => {
    res.json({ manage: await service.manageGet(req.params.slug, req.body) })
  })
)

// POST /manage/cancel — cancela a inscrição (liberta o lugar).
publicInvitesRouter.post(
  '/:slug/manage/cancel',
  asyncHandler(async (req, res) => {
    res.json({ manage: await service.manageCancel(req.params.slug, req.body) })
  })
)

// POST /manage/refund — pede reembolso (bilhete pago, dentro do prazo).
publicInvitesRouter.post(
  '/:slug/manage/refund',
  asyncHandler(async (req, res) => {
    res.json({ manage: await service.manageRefund(req.params.slug, req.body) })
  })
)

// ── Check-in móvel (link secreto por convite, autenticado por ?k=<token>) ──
// GET /checkin/context — cabeçalho da página (título/data) + valida o token.
publicInvitesRouter.get(
  '/:slug/checkin/context',
  asyncHandler(async (req, res) => {
    res.json({ context: await service.checkinContext(req.params.slug, req.query.k) })
  })
)

// GET /checkin/lookup — procura uma inscrição pelo código/QR do bilhete.
publicInvitesRouter.get(
  '/:slug/checkin/lookup',
  asyncHandler(async (req, res) => {
    res.json({ result: await service.checkinLookupPublic(req.params.slug, req.query.k, req.query.code) })
  })
)

// POST /checkin/:guestId — aceita (ou anula) o check-in da inscrição.
publicInvitesRouter.post(
  '/:slug/checkin/:guestId',
  asyncHandler(async (req, res) => {
    res.json({
      guest: await service.acceptCheckinPublic(req.params.slug, req.query.k, req.params.guestId, {
        on: req.body?.on !== false,
      }),
    })
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
