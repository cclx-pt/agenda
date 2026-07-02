import { Router } from 'express'
import { z } from 'zod'
import { verifyApprovalToken } from './token.js'
import * as usersRepo from '../users/repository.js'
import * as eventsRepo from '../events/repository.js'
import * as eventsService from '../events/service.js'
import { EventError } from '../events/service.js'

// Rotas PÚBLICAS (sem sessão): a autenticação é feita pelo token assinado que
// vai no link do email. Servem a página de confirmação /acao.
export const approvalActionRouter = Router()

// GET /data/approval-action?t=TOKEN — valida o token e devolve o evento para a
// página de confirmação. NÃO altera nada (o clique no email não deve executar
// a ação; os clientes de email fazem prefetch dos links).
approvalActionRouter.get('/', async (req, res, next) => {
  try {
    const decoded = verifyApprovalToken(req.query.t)
    if (!decoded) return res.status(410).json({ error: 'Ligação inválida ou expirada.' })
    const event = await eventsRepo.findById(decoded.eventId)
    if (!event) return res.status(404).json({ error: 'Evento não encontrado.' })
    const approver = await usersRepo.findById(decoded.approverId)
    res.json({
      event: {
        title: event.title,
        description: event.description,
        date: event.date,
        timeStart: event.timeStart,
        community: event.community,
        category: event.category,
        status: event.status,
        rejectionReason: event.rejectionReason,
      },
      approverName: approver?.name ?? null,
      pending: event.status === 'pendente',
    })
  } catch (err) {
    next(err)
  }
})

const actionSchema = z.object({
  t: z.string().min(1),
  action: z.enum(['approve', 'reject']),
  reason: z.string().trim().max(1000).optional(),
})

// POST /data/approval-action { t, action, reason } — executa a ação. O token
// autentica o aprovador; a operação revalida permissão e estado do evento.
approvalActionRouter.post('/', async (req, res, next) => {
  try {
    const parsed = actionSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' })
    }
    const { t, action, reason } = parsed.data
    const decoded = verifyApprovalToken(t)
    if (!decoded) return res.status(410).json({ error: 'Ligação inválida ou expirada.' })

    const approver = await usersRepo.findById(decoded.approverId)
    if (!approver || !approver.isActive) {
      return res.status(403).json({ error: 'Sem permissão.' })
    }
    // "Utilizador" reconstruído a partir do aprovador; o token substitui a sessão.
    const actor = {
      sub: approver.id,
      role: approver.role,
      churches: approver.churches ?? null,
      canViewPrivate: approver.canViewPrivate,
    }

    try {
      if (action === 'approve') {
        await eventsService.approve(actor, decoded.eventId)
        return res.json({ ok: true, action: 'approve' })
      }
      if (!reason || !reason.trim()) {
        return res.status(400).json({ error: 'Indique o motivo da rejeição.' })
      }
      await eventsService.reject(actor, decoded.eventId, reason)
      return res.json({ ok: true, action: 'reject' })
    } catch (err) {
      if (err instanceof EventError) return res.status(err.status).json({ error: err.message })
      throw err
    }
  } catch (err) {
    next(err)
  }
})
