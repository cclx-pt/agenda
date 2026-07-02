import { Router } from 'express'
import { z } from 'zod'
import { requireRole } from '../middleware/auth.js'
import * as service from './service.js'
import { ApproverScopeError } from './service.js'

// Configuração do âmbito dos aprovadores — só admin.
export const approverScopesRouter = Router()

const adminOnly = requireRole('admin')

function handle(err, res, next) {
  if (err instanceof ApproverScopeError) {
    return res.status(err.status).json({ error: err.message })
  }
  if (err instanceof z.ZodError) {
    return res.status(400).json({ error: err.issues[0]?.message ?? 'Dados inválidos.' })
  }
  next(err)
}

approverScopesRouter.get('/', adminOnly, async (_req, res, next) => {
  try {
    res.json({ scopes: await service.list() })
  } catch (err) {
    next(err)
  }
})

approverScopesRouter.get('/approvers', adminOnly, async (_req, res, next) => {
  try {
    res.json({ approvers: await service.listApprovers() })
  } catch (err) {
    next(err)
  }
})

approverScopesRouter.post('/', adminOnly, async (req, res, next) => {
  try {
    res.status(201).json({ scope: await service.create(req.body) })
  } catch (err) {
    handle(err, res, next)
  }
})

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
approverScopesRouter.delete('/:id', adminOnly, async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(404).json({ error: 'Configuração não encontrada.' })
    }
    await service.remove(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    handle(err, res, next)
  }
})
