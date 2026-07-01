import { Router } from 'express'
import { z } from 'zod'
import { requireRole } from '../middleware/auth.js'
import * as service from './service.js'
import { DelegationError } from './service.js'

export const delegationsRouter = Router()

// Só admin e aprovador gerem delegações de aprovação.
const manageRoles = requireRole('admin', 'aprovador')

function asyncHandler(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res)
    } catch (err) {
      if (err instanceof DelegationError) {
        return res.status(err.status).json({ error: err.message })
      }
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.issues[0]?.message ?? 'Dados inválidos.' })
      }
      next(err)
    }
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
delegationsRouter.param('id', (req, res, next, id) => {
  if (!UUID_RE.test(id)) {
    return res.status(404).json({ error: 'Delegação não encontrada.' })
  }
  next()
})

delegationsRouter.use(manageRoles)

delegationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ delegations: await service.listForUser(req.user) })
  })
)

// Editores ativos para o seletor de delegado (antes de qualquer rota /:id).
delegationsRouter.get(
  '/editors',
  asyncHandler(async (_req, res) => {
    res.json({ editors: await service.listEditors() })
  })
)

delegationsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    res.status(201).json({ delegation: await service.create(req.user, req.body) })
  })
)

delegationsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ delegation: await service.update(req.user, req.params.id, req.body) })
  })
)

delegationsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await service.remove(req.user, req.params.id)
    res.json({ ok: true })
  })
)
